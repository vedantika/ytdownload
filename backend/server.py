import os
import sys
import json
import uuid
import time
import threading
import subprocess
import requests
import urllib.parse
from flask import Flask, request, jsonify, Response, send_from_directory

try:
    from flask_cors import CORS
    has_cors = True
except ImportError:
    has_cors = False

import yt_dlp

app = Flask(__name__, static_folder="../frontend", static_url_path="")
if has_cors:
    CORS(app)

@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
    response.headers['Access-Control-Allow-Methods'] = 'GET,PUT,POST,DELETE,OPTIONS'
    return response


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.dirname(BASE_DIR)
if os.environ.get("VERCEL") or os.environ.get("VERCEL_ENV"):
    DOWNLOAD_DIR = "/tmp"
else:
    DOWNLOAD_DIR = os.path.join(APP_DIR, "downloads")

try:
    os.makedirs(DOWNLOAD_DIR, exist_ok=True)
except Exception:
    DOWNLOAD_DIR = "/tmp"
    os.makedirs(DOWNLOAD_DIR, exist_ok=True)

# In-memory dictionary for download tasks
# task_id -> dict
tasks = {}

def format_bytes(bytes_num):
    if not bytes_num:
        return "0 B"
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if bytes_num < 1024.0:
            return f"{bytes_num:.2f} {unit}"
        bytes_num /= 1024.0
    return f"{bytes_num:.2f} PB"

def format_seconds(seconds):
    if not seconds:
        return "0s"
    m, s = divmod(int(seconds), 60)
    h, m = divmod(m, 60)
    if h > 0:
        return f"{h}h {m}m {s}s"
    elif m > 0:
        return f"{m}m {s}s"
    else:
        return f"{s}s"

def parse_time_str(time_str):
    if not time_str:
        return None
    parts = time_str.strip().split(':')
    try:
        if len(parts) == 1:
            return float(parts[0])
        elif len(parts) == 2:
            return float(parts[0]) * 60 + float(parts[1])
        elif len(parts) == 3:
            return float(parts[0]) * 3600 + float(parts[1]) * 60 + float(parts[2])
    except ValueError:
        return None
    return None

@app.route("/")
def serve_index():
    possible_paths = [
        os.path.join(APP_DIR, "index.html"),
        os.path.join(APP_DIR, "frontend", "index.html"),
        os.path.join(os.getcwd(), "index.html"),
        os.path.join(os.getcwd(), "frontend", "index.html")
    ]
    for p in possible_paths:
        if os.path.exists(p):
            with open(p, "r", encoding="utf-8") as f:
                return Response(f.read(), mimetype="text/html")
    return "NovaStream Downloader Server Running", 200



@app.route("/api/info", methods=["POST"])
@app.route("/info", methods=["POST"])
def get_video_info():
    data = request.get_json() or {}
    url = data.get("url", "").strip()
    if not url:
        return jsonify({"error": "URL is required"}), 400

    if not url.startswith('http://') and not url.startswith('https://') and not url.startswith('ytsearch'):
        url = f"ytsearch1:{url}"
    elif url.startswith('ytsearch:'):
        query_text = url.replace('ytsearch:', '').strip()
        url = f"ytsearch1:{query_text}"



    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            
            # If search result, unwrap first entry
            if 'entries' in info and info['entries']:
                info = info['entries'][0]
            
            if 'entries' in info:
                # Playlist detected
                entries = []
                for entry in info['entries']:
                    if entry:
                        entries.append({
                            'id': entry.get('id'),
                            'title': entry.get('title'),
                            'url': entry.get('webpage_url') or f"https://www.youtube.com/watch?v={entry.get('id')}",
                            'duration': entry.get('duration'),
                            'duration_str': format_seconds(entry.get('duration')),
                            'thumbnail': entry.get('thumbnail'),
                            'uploader': entry.get('uploader') or entry.get('channel')
                        })
                return jsonify({
                    'is_playlist': True,
                    'title': info.get('title', 'Playlist'),
                    'playlist_count': len(entries),
                    'entries': entries
                })



            # Single video
            formats = info.get('formats', [])
            video_options = []
            audio_options = []

            # Extract distinct resolutions
            res_map = {}
            for f in formats:
                height = f.get('height')
                vcodec = f.get('vcodec', 'none')
                acodec = f.get('acodec', 'none')
                
                if height and vcodec != 'none':
                    res_label = f"{height}p"
                    if height >= 2160:
                        res_label += " (4K)"
                    elif height >= 1440:
                        res_label += " (2K)"
                    elif height >= 1080:
                        res_label += " (Full HD)"
                    elif height >= 720:
                        res_label += " (HD)"

                    if height not in res_map or (acodec != 'none' and res_map[height]['acodec'] == 'none'):
                        res_map[height] = {
                            'height': height,
                            'label': res_label,
                            'format_id': f.get('format_id'),
                            'ext': f.get('ext', 'mp4'),
                            'acodec': acodec,
                            'vcodec': vcodec,
                            'filesize': f.get('filesize') or f.get('filesize_approx')
                        }

            # Sort resolutions descending
            sorted_heights = sorted(res_map.keys(), reverse=True)
            for h in sorted_heights:
                item = res_map[h]
                video_options.append({
                    'height': h,
                    'label': item['label'],
                    'format_id': item['format_id'],
                    'filesize_str': format_bytes(item['filesize']) if item['filesize'] else 'Dynamic'
                })

            # Standard preset audio options
            audio_options = [
                {'format': 'mp3', 'quality': '320', 'label': 'MP3 (320 kbps Ultra)'},
                {'format': 'mp3', 'quality': '192', 'label': 'MP3 (192 kbps High)'},
                {'format': 'm4a', 'quality': '256', 'label': 'M4A AAC (High Quality)'},
                {'format': 'wav', 'quality': '0', 'label': 'WAV (Lossless Audio)'},
                {'format': 'flac', 'quality': '0', 'label': 'FLAC (Lossless Audio)'},
                {'format': 'opus', 'quality': '160', 'label': 'OPUS (Web Audio)'}
            ]

            subtitles = list(info.get('subtitles', {}).keys()) + list(info.get('automatic_captions', {}).keys())
            unique_subs = sorted(list(set(subtitles)))

            result = {
                'is_playlist': False,
                'id': info.get('id'),
                'title': info.get('title'),
                'uploader': info.get('uploader') or info.get('channel', 'Unknown'),
                'duration': info.get('duration', 0),
                'duration_str': format_seconds(info.get('duration', 0)),
                'thumbnail': info.get('thumbnail') or (info.get('thumbnails')[-1]['url'] if info.get('thumbnails') else ''),
                'view_count': info.get('view_count', 0),
                'view_count_str': f"{info.get('view_count', 0):,}" if info.get('view_count') else 'N/A',
                'upload_date': info.get('upload_date', ''),
                'webpage_url': info.get('webpage_url', url),
                'video_options': video_options,
                'audio_options': audio_options,
                'subtitles': unique_subs[:15] # Top subtitle languages
            }

            return jsonify(result)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

def run_download_thread(task_id, url, options):
    if not url.startswith('http://') and not url.startswith('https://') and not url.startswith('ytsearch'):
        url = f"ytsearch1:{url}"
    elif url.startswith('ytsearch:'):
        query_text = url.replace('ytsearch:', '').strip()
        url = f"ytsearch1:{query_text}"

    download_type = options.get('download_type', 'video') # 'video', 'audio', 'video_only'

    height = options.get('height')
    audio_format = options.get('audio_format', 'mp3')
    audio_quality = options.get('audio_quality', '320')
    start_time = options.get('start_time')
    end_time = options.get('end_time')
    embed_subs = options.get('embed_subs', False)
    sub_lang = options.get('sub_lang', 'en')

    def progress_hook(d):
        if d['status'] == 'downloading':
            total = d.get('total_bytes') or d.get('total_bytes_estimate') or 0
            downloaded = d.get('downloaded_bytes') or 0
            speed = d.get('speed') or 0
            eta = d.get('eta') or 0
            percent = (downloaded / total * 100) if total > 0 else 0

            tasks[task_id].update({
                'status': 'downloading',
                'progress': round(percent, 1),
                'downloaded_bytes': downloaded,
                'total_bytes': total,
                'downloaded_str': format_bytes(downloaded),
                'total_str': format_bytes(total),
                'speed_str': f"{format_bytes(speed)}/s" if speed else "Calculating...",
                'eta_str': format_seconds(eta) if eta else "Calculating..."
            })
        elif d['status'] == 'finished':
            tasks[task_id].update({
                'status': 'converting',
                'progress': 99.0,
                'status_text': 'Processing / Converting file...'
            })

    output_filename_template = f"%(title)s_[{task_id[:8]}].%(ext)s"
    output_path_template = os.path.join(DOWNLOAD_DIR, output_filename_template)

    ydl_opts = {
        'outtmpl': output_path_template,
        'progress_hooks': [progress_hook],
        'quiet': True,
        'no_warnings': True,
    }

    # Format logic
    if download_type == 'audio':
        ydl_opts['format'] = 'bestaudio/best'
        ydl_opts['postprocessors'] = [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': audio_format,
            'preferredquality': audio_quality,
        }]
    elif download_type == 'whatsapp':
        # WhatsApp Status requires H.264 (yuv420p) + AAC audio in MP4 container with faststart flags
        if height:
            ydl_opts['format'] = f"bestvideo[height<={height}]+bestaudio/best[height<={height}]/best"
        else:
            ydl_opts['format'] = "bestvideo[height<=1080]+bestaudio/best[height<=1080]/best"
        ydl_opts['merge_output_format'] = 'mp4'
        ydl_opts['postprocessor_args'] = {
            'ffmpeg': [
                '-c:v', 'libx264',
                '-pix_fmt', 'yuv420p',
                '-profile:v', 'main',
                '-c:a', 'aac',
                '-b:a', '128k',
                '-movflags', '+faststart'
            ]
        }
    elif download_type == 'video_only':
        if height:
            ydl_opts['format'] = f"bestvideo[height<={height}]/bestvideo"
        else:
            ydl_opts['format'] = "bestvideo"
    else: # Video + Audio
        if height:
            ydl_opts['format'] = f"bestvideo[height<={height}]+bestaudio/best[height<={height}]/best"
        else:
            ydl_opts['format'] = "bestvideo+bestaudio/best"
        ydl_opts['merge_output_format'] = 'mp4'


    # Subtitles
    if embed_subs:
        ydl_opts['writesubtitles'] = True
        ydl_opts['subtitleslangs'] = [sub_lang]
        if 'postprocessors' not in ydl_opts:
            ydl_opts['postprocessors'] = []
        ydl_opts['postprocessors'].append({
            'key': 'FFmpegEmbedSubtitle',
            'already_have_subtitle': False
        })

    # Time Trimming
    start_sec = parse_time_str(start_time)
    end_sec = parse_time_str(end_time)
    if start_sec is not None or end_sec is not None:
        try:
            ydl_opts['download_ranges'] = yt_dlp.utils.download_range_func(None, [(start_sec or 0, end_sec or float('inf'))])
            ydl_opts['force_keyframes_at_cuts'] = True
        except Exception as ex:
            print("Download range setup notice:", ex)

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            if 'entries' in info and info['entries']:
                info = info['entries'][0]
            
            # Find the actual downloaded file name in DOWNLOAD_DIR matching task_id[:8]

            short_id = task_id[:8]
            final_file = None
            for fname in os.listdir(DOWNLOAD_DIR):
                if short_id in fname and not fname.endswith('.part') and not fname.endswith('.ytdl'):
                    final_file = fname
                    break

            if not final_file:
                # Fallback to requested file path
                filename = ydl.prepare_filename(info)
                final_file = os.path.basename(filename)

            file_size = 0
            file_full_path = os.path.join(DOWNLOAD_DIR, final_file)
            if os.path.exists(file_full_path):
                file_size = os.path.getsize(file_full_path)

            tasks[task_id].update({
                'status': 'completed',
                'progress': 100.0,
                'filename': final_file,
                'file_size': file_size,
                'file_size_str': format_bytes(file_size),
                'file_url': f"/api/files/{final_file}",
                'title': info.get('title', 'Downloaded Media'),
                'thumbnail': info.get('thumbnail', ''),
                'completed_at': time.strftime("%Y-%m-%d %H:%M:%S")
            })
    except Exception as e:
        tasks[task_id].update({
            'status': 'error',
            'error': str(e)
        })

@app.route("/api/download", methods=["POST"])
def start_download():
    data = request.get_json() or {}
    url = data.get("url", "").strip()
    if not url:
        return jsonify({"error": "URL is required"}), 400

    task_id = str(uuid.uuid4())
    tasks[task_id] = {
        'id': task_id,
        'url': url,
        'title': data.get('title', 'Preparing...'),
        'thumbnail': data.get('thumbnail', ''),
        'status': 'starting',
        'progress': 0.0,
        'downloaded_bytes': 0,
        'total_bytes': 0,
        'speed_str': 'Starting...',
        'eta_str': 'Starting...',
        'created_at': time.time()
    }

    thread = threading.Thread(target=run_download_thread, args=(task_id, url, data))
    thread.daemon = True
    thread.start()

    return jsonify({"task_id": task_id, "message": "Download initiated"})

@app.route("/api/progress/<task_id>")
def stream_progress(task_id):
    def event_stream():
        while True:
            task = tasks.get(task_id)
            if not task:
                yield f"data: {json.dumps({'status': 'not_found'})}\n\n"
                break
            
            yield f"data: {json.dumps(task)}\n\n"

            if task['status'] in ['completed', 'error']:
                break
            time.sleep(0.5)

    return Response(event_stream(), mimetype="text/event-stream")

@app.route("/api/files/<path:filename>")
@app.route("/files/<path:filename>")
def get_file(filename):
    return send_from_directory(DOWNLOAD_DIR, filename, as_attachment=True)

@app.route("/api/stream/<path:filename>")
@app.route("/stream/<path:filename>")
def stream_file(filename):
    return send_from_directory(DOWNLOAD_DIR, filename)

@app.route("/api/history", methods=["GET"])
@app.route("/history", methods=["GET"])
def get_history():
    history = []
    for task_id, task in sorted(tasks.items(), key=lambda x: x[1].get('created_at', 0), reverse=True):
        if task.get('status') == 'completed':
            history.append(task)
    return jsonify(history)

@app.route("/api/open-folder", methods=["POST"])
@app.route("/open-folder", methods=["POST"])
def open_folder():
    try:
        if sys.platform == 'win32':
            os.startfile(DOWNLOAD_DIR)
        elif sys.platform == 'darwin':
            subprocess.Popen(['open', DOWNLOAD_DIR])
        else:
            subprocess.Popen(['xdg-open', DOWNLOAD_DIR])
        return jsonify({"message": "Opened downloads folder"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/stream-full", methods=["GET"])
@app.route("/stream-full", methods=["GET"])
def stream_full_audio():
    query = request.args.get("q", "").strip()
    if not query:
        return jsonify({"error": "Query required"}), 400
    
    try:
        ydl_opts = {
            'format': 'bestaudio/best',
            'quiet': True,
            'no_warnings': True,
            'default_search': 'ytsearch1:'
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(query, download=False)
            entry = info['entries'][0] if 'entries' in info and len(info['entries']) > 0 else info
            
            return jsonify({
                'title': entry.get('title'),
                'uploader': entry.get('uploader') or entry.get('channel'),
                'duration': entry.get('duration', 0),
                'duration_str': format_seconds(entry.get('duration', 0)),
                'stream_url': entry.get('url')
            })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/music/artist-discography", methods=["GET"])
@app.route("/music/artist-discography", methods=["GET"])
def artist_discography():
    query = request.args.get("q", "").strip()
    if not query:
        return jsonify({"error": "Artist query is required"}), 400
    try:
        url = f"https://itunes.apple.com/search?term={urllib.parse.quote(query)}&entity=album&limit=15"
        headers = {'User-Agent': 'Mozilla/5.0'}
        resp = requests.get(url, headers=headers, timeout=10)
        data = resp.json()
        
        albums = []
        for item in data.get('results', []):
            albums.append({
                'album_id': item.get('collectionId'),
                'album_title': item.get('collectionName'),
                'artist_name': item.get('artistName'),
                'cover': item.get('artworkUrl100', '').replace('100x100bb', '400x400bb'),
                'release_year': item.get('releaseDate', '')[:4] if item.get('releaseDate') else '',
                'track_count': item.get('trackCount', 0),
                'primary_genre': item.get('primaryGenreName', 'Music')
            })
        return jsonify({'albums': albums})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/music/album-tracks", methods=["GET"])
@app.route("/music/album-tracks", methods=["GET"])
def album_tracks():
    album_id = request.args.get("id", "").strip()
    if not album_id:
        return jsonify({"error": "Album ID is required"}), 400
    try:
        url = f"https://itunes.apple.com/lookup?id={album_id}&entity=song"
        headers = {'User-Agent': 'Mozilla/5.0'}
        resp = requests.get(url, headers=headers, timeout=10)
        data = resp.json()
        
        results = data.get('results', [])
        album_info = results[0] if len(results) > 0 else {}
        tracks = []
        
        for item in results[1:]: # Skip index 0 which is album metadata
            tracks.append({
                'track_number': item.get('trackNumber', 0),
                'title': item.get('trackName'),
                'artist': item.get('artistName'),
                'album': item.get('collectionName'),
                'preview': item.get('previewUrl'),
                'duration': item.get('trackTimeMillis', 0) // 1000,
                'duration_str': format_seconds(item.get('trackTimeMillis', 0) // 1000)
            })
        return jsonify({
            'album_title': album_info.get('collectionName'),
            'artist_name': album_info.get('artistName'),
            'cover': album_info.get('artworkUrl100', '').replace('100x100bb', '400x400bb'),
            'tracks': tracks
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/music/search", methods=["GET"])
@app.route("/music/search", methods=["GET"])
def music_search():


    query = request.args.get("q", "").strip()
    if not query:
        return jsonify({"error": "Search query is required"}), 400
    try:
        url = f"https://itunes.apple.com/search?term={urllib.parse.quote(query)}&entity=song&limit=25"
        headers = {'User-Agent': 'Mozilla/5.0'}
        resp = requests.get(url, headers=headers, timeout=10)
        data = resp.json()
        
        tracks = []
        for item in data.get('results', []):
            tracks.append({
                'id': item.get('trackId'),
                'title': item.get('trackName'),
                'artist': item.get('artistName'),
                'album': item.get('collectionName'),
                'cover': item.get('artworkUrl100', '').replace('100x100bb', '300x300bb'),
                'preview': item.get('previewUrl'),
                'duration': item.get('trackTimeMillis', 0) // 1000,
                'duration_str': format_seconds(item.get('trackTimeMillis', 0) // 1000)
            })
        return jsonify({'tracks': tracks})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/music/trending", methods=["GET"])
@app.route("/music/trending", methods=["GET"])
def music_trending():
    try:
        url = "https://itunes.apple.com/search?term=top+hits&entity=song&limit=20"
        headers = {'User-Agent': 'Mozilla/5.0'}
        resp = requests.get(url, headers=headers, timeout=10)
        data = resp.json()
        
        tracks = []
        for item in data.get('results', []):
            tracks.append({
                'id': item.get('trackId'),
                'title': item.get('trackName'),
                'artist': item.get('artistName'),
                'album': item.get('collectionName'),
                'cover': item.get('artworkUrl100', '').replace('100x100bb', '300x300bb'),
                'preview': item.get('previewUrl'),
                'duration': item.get('trackTimeMillis', 0) // 1000,
                'duration_str': format_seconds(item.get('trackTimeMillis', 0) // 1000)
            })
        return jsonify({'tracks': tracks})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def get_local_ip():
    try:
        import socket
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

@app.route("/api/network-info", methods=["GET"])
@app.route("/network-info", methods=["GET"])
def network_info():
    local_ip = get_local_ip()
    return jsonify({
        "local_ip": local_ip,
        "port": 5050,
        "iphone_url": f"http://{local_ip}:5050"
    })

@app.route("/api/deezer/search", methods=["GET"])
@app.route("/deezer/search", methods=["GET"])
def deezer_search():

    return music_search()

@app.route("/api/deezer/charts", methods=["GET"])
@app.route("/deezer/charts", methods=["GET"])
def deezer_charts():
    return music_trending()


@app.route("/<path:path>")
def serve_static(path):
    if path.startswith("api/"):
        return jsonify({"error": "API endpoint not found"}), 404
    possible_paths = [
        os.path.join(APP_DIR, path),
        os.path.join(APP_DIR, "frontend", path),
        os.path.join(os.getcwd(), path),
        os.path.join(os.getcwd(), "frontend", path)
    ]
    for p in possible_paths:
        if os.path.exists(p) and os.path.isfile(p):
            mimetype = "text/css" if path.endswith(".css") else "application/javascript" if path.endswith(".js") else None
            with open(p, "rb") as f:
                return Response(f.read(), mimetype=mimetype)
    return jsonify({"error": "File not found"}), 404


if __name__ == "__main__":
    print(f"[*] YouTube Downloader Server running at http://127.0.0.1:5050")
    print(f"[*] Downloads directory: {DOWNLOAD_DIR}")
    app.run(host="0.0.0.0", port=5050, debug=False)
