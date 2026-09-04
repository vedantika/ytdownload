document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const urlInput = document.getElementById('urlInput');
    const fetchBtn = document.getElementById('fetchBtn');
    const pasteBtn = document.getElementById('pasteBtn');
    const clearBtn = document.getElementById('clearBtn');
    const loadingSkeleton = document.getElementById('loadingSkeleton');
    const mediaCard = document.getElementById('mediaCard');
    const openFolderBtn = document.getElementById('openFolderBtn');
    const sampleChips = document.querySelectorAll('.sample-chip');

    // Media Details Elements
    const videoThumb = document.getElementById('videoThumb');
    const videoDuration = document.getElementById('videoDuration');
    const videoTitle = document.getElementById('videoTitle');
    const videoUploader = document.getElementById('videoUploader');
    const videoViews = document.getElementById('videoViews');
    const videoDate = document.getElementById('videoDate');
    const playPreviewBtn = document.getElementById('playPreviewBtn');

    // Tabs & Grids
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const videoQualityGrid = document.getElementById('videoQualityGrid');
    const whatsappQualityGrid = document.getElementById('whatsappQualityGrid');
    const audioQualityGrid = document.getElementById('audioQualityGrid');
    const videoOnlyQualityGrid = document.getElementById('videoOnlyQualityGrid');

    // Advanced Accordion
    const advancedToggle = document.getElementById('advancedToggle');
    const advancedContent = document.getElementById('advancedContent');
    const embedSubCheck = document.getElementById('embedSubCheck');
    const subLangSelect = document.getElementById('subLangSelect');
    const trimStart = document.getElementById('trimStart');
    const trimEnd = document.getElementById('trimEnd');

    // Download & Active Tasks
    const startDownloadBtn = document.getElementById('startDownloadBtn');
    const activeDownloadsSection = document.getElementById('activeDownloadsSection');
    const activeDownloadsList = document.getElementById('activeDownloadsList');
    const activeTasksCount = document.getElementById('activeTasksCount');

    // Library & Modal
    const historyGrid = document.getElementById('historyGrid');
    const emptyHistory = document.getElementById('emptyHistory');
    const refreshHistoryBtn = document.getElementById('refreshHistoryBtn');
    const playerModal = document.getElementById('playerModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalMediaContainer = document.getElementById('modalMediaContainer');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const toastContainer = document.getElementById('toastContainer');

    // iPhone Modal Elements
    const headerIphoneBtn = document.getElementById('headerIphoneBtn');
    const iphoneModal = document.getElementById('iphoneModal');
    const closeIphoneModalBtn = document.getElementById('closeIphoneModalBtn');
    const iphoneFileTitle = document.getElementById('iphoneFileTitle');
    const qrCodeImg = document.getElementById('qrCodeImg');
    const iphoneDirectUrl = document.getElementById('iphoneDirectUrl');
    const copyIphoneUrlBtn = document.getElementById('copyIphoneUrlBtn');

    // Deezer & Discography Elements
    const deezerSearchInput = document.getElementById('deezerSearchInput');
    const deezerSearchBtn = document.getElementById('deezerSearchBtn');
    const deezerResultsGrid = document.getElementById('deezerResultsGrid');
    const artistSearchInput = document.getElementById('artistSearchInput');
    const artistSearchBtn = document.getElementById('artistSearchBtn');
    const albumsGrid = document.getElementById('albumsGrid');

    // State Variables
    let currentInfo = null;
    let selectedTab = 'video';
    let selectedOption = { type: 'video', height: 1080 };
    let activeSSETasks = new Map();

    // Initial load
    fetchHistory();
    fetchDeezerCharts();
    searchDiscography('Coldplay');

    // Event Listeners
    urlInput.addEventListener('input', () => {
        clearBtn.style.display = urlInput.value ? 'block' : 'none';
    });

    clearBtn.addEventListener('click', () => {
        urlInput.value = '';
        clearBtn.style.display = 'none';
        mediaCard.style.display = 'none';
        currentInfo = null;
    });

    pasteBtn.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                urlInput.value = text;
                clearBtn.style.display = 'block';
                showToast('Pasted URL from clipboard', 'info');
                fetchVideoInfo();
            }
        } catch (e) {
            showToast('Unable to read clipboard', 'error');
        }
    });

    sampleChips.forEach(chip => {
        chip.addEventListener('click', () => {
            urlInput.value = chip.dataset.url;
            clearBtn.style.display = 'block';
            fetchVideoInfo();
        });
    });

    fetchBtn.addEventListener('click', fetchVideoInfo);
    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') fetchVideoInfo();
    });

    openFolderBtn.addEventListener('click', async () => {
        try {
            const res = await fetch('/api/open-folder', { method: 'POST' });
            const data = await res.json();
            if (data.error) showToast(data.error, 'error');
            else showToast('Opened downloads folder', 'success');
        } catch (e) {
            showToast('Failed to open downloads folder', 'error');
        }
    });

    // Tab Switching
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.style.display = 'none');
            
            btn.classList.add('active');
            selectedTab = btn.dataset.tab;

            if (selectedTab === 'video') {
                document.getElementById('tabVideo').style.display = 'block';
            } else if (selectedTab === 'whatsapp') {
                document.getElementById('tabWhatsapp').style.display = 'block';
            } else if (selectedTab === 'audio') {
                document.getElementById('tabAudio').style.display = 'block';
            } else if (selectedTab === 'video_only') {
                document.getElementById('tabVideoOnly').style.display = 'block';
            }

            selectFirstChipInActiveTab();
        });
    });

    // Accordion Toggle
    advancedToggle.addEventListener('click', () => {
        const isOpen = advancedContent.style.display === 'block';
        advancedContent.style.display = isOpen ? 'none' : 'block';
        advancedToggle.querySelector('.toggle-icon').style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
    });

    embedSubCheck.addEventListener('change', () => {
        subLangSelect.disabled = !embedSubCheck.checked;
    });

    startDownloadBtn.addEventListener('click', initiateDownload);
    refreshHistoryBtn.addEventListener('click', fetchHistory);

    closeModalBtn.addEventListener('click', () => {
        playerModal.style.display = 'none';
        modalMediaContainer.innerHTML = '';
    });

    closeIphoneModalBtn.addEventListener('click', () => {
        iphoneModal.style.display = 'none';
    });

    headerIphoneBtn.addEventListener('click', () => {
        openIphoneTransferModal();
    });

    copyIphoneUrlBtn.addEventListener('click', () => {
        if (iphoneDirectUrl.value) {
            navigator.clipboard.writeText(iphoneDirectUrl.value);
            showToast('iPhone Direct Link copied!', 'success');
        }
    });

    playPreviewBtn.addEventListener('click', () => {
        if (!currentInfo || !currentInfo.id) return;
        const embedUrl = `https://www.youtube.com/embed/${currentInfo.id}?autoplay=1`;
        modalTitle.textContent = `Preview: ${currentInfo.title}`;
        modalMediaContainer.innerHTML = `
            <iframe src="${embedUrl}" width="100%" height="400" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen style="border-radius:12px;"></iframe>
        `;
        playerModal.style.display = 'flex';
    });

    // Fetch Video Info
    async function fetchVideoInfo() {
        const url = urlInput.value.trim();
        if (!url) {
            showToast('Please enter a YouTube link or song name', 'error');
            return;
        }

        mediaCard.style.display = 'none';
        loadingSkeleton.style.display = 'flex';
        fetchBtn.disabled = true;
        fetchBtn.querySelector('span').textContent = 'Analyzing...';

        try {
            const res = await fetch('/api/info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });

            const data = await res.json();

            if (!res.ok || data.error) {
                throw new Error(data.error || 'Failed to fetch details');
            }

            currentInfo = data;
            renderMediaCard(data);
            showToast('Metadata extracted!', 'success');

        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            loadingSkeleton.style.display = 'none';
            fetchBtn.disabled = false;
            fetchBtn.querySelector('span').textContent = 'Fetch Details';
        }
    }

    // Render Media Card
    function renderMediaCard(info) {
        videoThumb.src = info.thumbnail || '';
        videoDuration.textContent = info.duration_str || '00:00';
        videoTitle.textContent = info.title || 'YouTube Video';
        videoUploader.textContent = info.uploader || 'Unknown Channel';
        videoViews.textContent = info.view_count_str || 'N/A views';
        videoDate.textContent = info.upload_date ? formatDate(info.upload_date) : 'N/A';

        // Render Subtitles
        subLangSelect.innerHTML = '';
        if (info.subtitles && info.subtitles.length > 0) {
            info.subtitles.forEach(lang => {
                const opt = document.createElement('option');
                opt.value = lang;
                opt.textContent = lang.toUpperCase();
                subLangSelect.appendChild(opt);
            });
        } else {
            const opt = document.createElement('option');
            opt.value = 'en';
            opt.textContent = 'English (Auto)';
            subLangSelect.appendChild(opt);
        }

        // Render Video + Audio Chips
        videoQualityGrid.innerHTML = '';
        const vOpts = (info.video_options && info.video_options.length > 0) ? info.video_options : [
            { height: 1080, label: '1080p Full HD', filesize_str: 'MP4' },
            { height: 720, label: '720p HD', filesize_str: 'MP4' },
            { height: 480, label: '480p SD', filesize_str: 'MP4' }
        ];

        vOpts.forEach((opt, idx) => {
            const chip = createChip(opt.label, opt.filesize_str || 'MP4 Video', () => {
                selectedOption = { type: 'video', height: opt.height };
            });
            if (idx === 0) chip.classList.add('selected');
            videoQualityGrid.appendChild(chip);
        });

        // Render WhatsApp Status Chips
        whatsappQualityGrid.innerHTML = '';
        const waPresets = [
            { height: 720, label: '720p HD Status (Recommended)', sub: 'H.264 + AAC MP4' },
            { height: 1080, label: '1080p Full HD Status', sub: 'H.264 + AAC MP4' },
            { height: 480, label: '480p Fast Status', sub: 'Compact Size MP4' }
        ];
        waPresets.forEach(opt => {
            const chip = createChip(opt.label, opt.sub, () => {
                selectedOption = { type: 'whatsapp', height: opt.height };
            });
            whatsappQualityGrid.appendChild(chip);
        });

        // Render Audio Chips
        audioQualityGrid.innerHTML = '';
        const defaultAudioOpts = (info.audio_options && info.audio_options.length > 0) ? info.audio_options : [
            {'format': 'mp3', 'quality': '320', 'label': 'MP3 (320 kbps Ultra)'},
            {'format': 'mp3', 'quality': '192', 'label': 'MP3 (192 kbps High)'},
            {'format': 'm4a', 'quality': '256', 'label': 'M4A AAC (High Quality)'},
            {'format': 'wav', 'quality': '0', 'label': 'WAV (Lossless Audio)'},
            {'format': 'flac', 'quality': '0', 'label': 'FLAC (Lossless Audio)'}
        ];
        defaultAudioOpts.forEach((opt, idx) => {
            const chip = createChip(opt.label, 'Audio Extraction', () => {
                selectedOption = { type: 'audio', audio_format: opt.format, audio_quality: opt.quality };
            });
            if (idx === 0) chip.classList.add('selected');
            audioQualityGrid.appendChild(chip);
        });

        // Render Video Only Chips
        videoOnlyQualityGrid.innerHTML = '';
        vOpts.forEach((opt) => {
            const chip = createChip(`${opt.label} (No Audio)`, 'Silent MP4', () => {
                selectedOption = { type: 'video_only', height: opt.height };
            });
            videoOnlyQualityGrid.appendChild(chip);
        });

        mediaCard.style.display = 'block';
        selectFirstChipInActiveTab();
    }

    function createChip(title, subtitle, onSelect) {
        const chip = document.createElement('div');
        chip.className = 'option-chip';
        chip.innerHTML = `
            <div class="chip-label">${title}</div>
            <div class="chip-sub">${subtitle}</div>
        `;
        chip.addEventListener('click', () => {
            const parent = chip.parentElement;
            if (parent) parent.querySelectorAll('.option-chip').forEach(c => c.classList.remove('selected'));
            chip.classList.add('selected');
            onSelect();
        });
        return chip;
    }

    function selectFirstChipInActiveTab() {
        let grid;
        if (selectedTab === 'video') grid = videoQualityGrid;
        else if (selectedTab === 'whatsapp') grid = whatsappQualityGrid;
        else if (selectedTab === 'audio') grid = audioQualityGrid;
        else grid = videoOnlyQualityGrid;

        if (grid) {
            const firstChip = grid.querySelector('.option-chip');
            if (firstChip) firstChip.click();
        }
    }

    // Initiate Download
    async function initiateDownload() {
        if (!currentInfo) {
            showToast('Please fetch a video or song first', 'error');
            return;
        }

        const payload = {
            url: urlInput.value.trim(),
            title: currentInfo.title,
            thumbnail: currentInfo.thumbnail,
            download_type: selectedTab,
            height: selectedOption ? selectedOption.height : null,
            audio_format: selectedOption ? selectedOption.audio_format : 'mp3',
            audio_quality: selectedOption ? selectedOption.audio_quality : '320',
            start_time: trimStart.value.trim(),
            end_time: trimEnd.value.trim(),
            embed_subs: embedSubCheck.checked,
            sub_lang: subLangSelect.value
        };

        startDownloadBtn.disabled = true;
        startDownloadBtn.querySelector('span').textContent = 'Starting Engine...';

        try {
            const res = await fetch('/api/download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error || 'Failed to start download');

            showToast('Download engine active!', 'success');
            activeDownloadsSection.style.display = 'block';

            connectSSE(data.task_id, currentInfo.title, currentInfo.thumbnail);

        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            startDownloadBtn.disabled = false;
            startDownloadBtn.querySelector('span').textContent = 'Start Download Now';
        }
    }

    // Server-Sent Events (SSE) Progress Connection
    function connectSSE(taskId, title, thumbnail) {
        if (activeSSETasks.has(taskId)) return;

        const itemCard = createDownloadProgressCard(taskId, title, thumbnail);
        activeDownloadsList.prepend(itemCard);

        const evtSource = new EventSource(`/api/progress/${taskId}`);
        activeSSETasks.set(taskId, evtSource);
        updateActiveBadge();

        evtSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.status === 'not_found') {
                evtSource.close();
                activeSSETasks.delete(taskId);
                updateActiveBadge();
                return;
            }

            updateDownloadProgressCard(taskId, data);

            if (data.status === 'completed') {
                evtSource.close();
                activeSSETasks.delete(taskId);
                updateActiveBadge();
                showToast(`Finished: ${(title || 'Media').substring(0, 30)}...`, 'success');
                setTimeout(() => {
                    itemCard.remove();
                    if (activeDownloadsList.children.length === 0) {
                        activeDownloadsSection.style.display = 'none';
                    }
                    fetchHistory();
                }, 3000);
            } else if (data.status === 'error') {
                evtSource.close();
                activeSSETasks.delete(taskId);
                updateActiveBadge();
                showToast(`Download failed: ${data.error}`, 'error');
            }
        };

        evtSource.onerror = () => {
            evtSource.close();
            activeSSETasks.delete(taskId);
            updateActiveBadge();
        };
    }

    function createDownloadProgressCard(taskId, title, thumbnail) {
        const div = document.createElement('div');
        div.className = 'download-item-card';
        div.id = `task-card-${taskId}`;
        div.innerHTML = `
            <img class="dl-thumb" src="${thumbnail || ''}" alt="thumb">
            <div class="dl-details">
                <div class="dl-title">${title}</div>
                <div class="progress-bar-container">
                    <div class="progress-fill" style="width: 0%"></div>
                </div>
                <div class="dl-stats">
                    <span class="status-txt">Starting...</span>
                    <span class="speed-txt">0 KB/s</span>
                    <span class="bytes-txt">0 MB / 0 MB</span>
                    <span class="eta-txt">ETA: --</span>
                </div>
            </div>
        `;
        return div;
    }

    function updateDownloadProgressCard(taskId, data) {
        const card = document.getElementById(`task-card-${taskId}`);
        if (!card) return;

        const progressFill = card.querySelector('.progress-fill');
        const statusTxt = card.querySelector('.status-txt');
        const speedTxt = card.querySelector('.speed-txt');
        const bytesTxt = card.querySelector('.bytes-txt');
        const etaTxt = card.querySelector('.eta-txt');

        const percent = data.progress || 0;
        progressFill.style.width = `${percent}%`;

        if (data.status === 'downloading') {
            statusTxt.textContent = `${percent}%`;
            speedTxt.textContent = data.speed_str || '';
            bytesTxt.textContent = `${data.downloaded_str || '0 B'} / ${data.total_str || '0 B'}`;
            etaTxt.textContent = `ETA: ${data.eta_str || '--'}`;
        } else if (data.status === 'converting') {
            statusTxt.textContent = 'Processing / Merging...';
            speedTxt.textContent = 'FFmpeg';
            bytesTxt.textContent = 'Converting format';
            etaTxt.textContent = 'Almost done';
        } else if (data.status === 'completed') {
            statusTxt.textContent = 'Complete! 100%';
            speedTxt.textContent = '';
            bytesTxt.textContent = data.file_size_str || '';
            etaTxt.textContent = 'Done';
        }
    }

    function updateActiveBadge() {
        const count = activeSSETasks.size;
        activeTasksCount.textContent = `${count} Active`;
    }

    // Deezer & Discography Functions
    artistSearchBtn.addEventListener('click', () => searchDiscography());
    artistSearchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchDiscography();
    });

    deezerSearchBtn.addEventListener('click', searchDeezer);
    deezerSearchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchDeezer();
    });

    async function searchDiscography(artistQuery) {
        const query = artistQuery || artistSearchInput.value.trim();
        if (!query) return;
        
        artistSearchBtn.disabled = true;
        try {
            const res = await fetch(`/api/music/artist-discography?q=${encodeURIComponent(query)}`);
            const data = await res.json();
            if (data.albums) renderAlbums(data.albums);
        } catch (e) {
            showToast('Discography search failed', 'error');
        } finally {
            artistSearchBtn.disabled = false;
        }
    }

    function renderAlbums(albums) {
        albumsGrid.innerHTML = '';
        if (!albums || albums.length === 0) {
            albumsGrid.innerHTML = '<div class="empty-state">No albums found for artist</div>';
            return;
        }

        albums.forEach(album => {
            const card = document.createElement('div');
            card.className = 'album-card';
            card.innerHTML = `
                <div class="album-cover-wrapper">
                    <img src="${album.cover || ''}" alt="cover">
                </div>
                <div class="album-title">${album.album_title}</div>
                <div class="album-meta">
                    <span>${album.artist_name}</span>
                    <span>${album.release_year ? album.release_year + ' • ' : ''}${album.track_count} tracks</span>
                </div>
            `;

            card.addEventListener('click', () => {
                viewAlbumTracks(album.album_id, album.album_title, album.artist_name);
            });

            albumsGrid.appendChild(card);
        });
    }

    async function viewAlbumTracks(albumId, albumTitle, artistName) {
        modalTitle.textContent = `Album: ${albumTitle} (${artistName})`;
        modalMediaContainer.innerHTML = '<div style="color:var(--text-muted); padding:30px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading tracklist...</div>';
        playerModal.style.display = 'flex';

        try {
            const res = await fetch(`/api/music/album-tracks?id=${albumId}`);
            const data = await res.json();

            if (!data.tracks || data.tracks.length === 0) {
                modalMediaContainer.innerHTML = '<div class="empty-state">No tracklist available</div>';
                return;
            }

            const container = document.createElement('div');
            container.className = 'tracklist-container';

            data.tracks.forEach(t => {
                const row = document.createElement('div');
                row.className = 'track-row';
                row.innerHTML = `
                    <div class="track-num-title">
                        <span class="track-number">${t.track_number || '#'}</span>
                        <span>${t.title}</span>
                    </div>
                    <div class="track-actions">
                        <button class="btn btn-sm btn-primary play-full-btn" data-query="${t.artist} ${t.title}">
                            <i class="fa-solid fa-fire-flame-curved"></i> Stream FULL
                        </button>
                        <button class="btn btn-sm btn-glass direct-mp3-btn" data-query="${t.artist} ${t.title}" data-title="${t.artist} - ${t.title}">
                            <i class="fa-solid fa-download"></i> Direct MP3
                        </button>
                        <button class="btn btn-sm btn-glass load-dl-btn" data-query="${t.artist} ${t.title}">
                            <i class="fa-solid fa-sliders"></i> Options
                        </button>
                    </div>
                `;

                row.querySelector('.play-full-btn').addEventListener('click', async (e) => {
                    const q = e.currentTarget.dataset.query;
                    showToast(`Fetching full stream for ${t.title}...`, 'info');
                    try {
                        const sRes = await fetch(`/api/stream-full?q=${encodeURIComponent(q)}`);
                        const sData = await sRes.json();
                        if (sData.stream_url) {
                            modalMediaContainer.innerHTML = `<audio controls autoplay src="${sData.stream_url}"></audio>`;
                            showToast('Streaming track live!', 'success');
                        }
                    } catch (err) {
                        showToast('Failed to fetch audio stream', 'error');
                    }
                });

                row.querySelector('.direct-mp3-btn').addEventListener('click', (e) => {
                    const btn = e.currentTarget;
                    playerModal.style.display = 'none';
                    downloadDirectMP3(btn.dataset.query, btn.dataset.title);
                });

                row.querySelector('.load-dl-btn').addEventListener('click', (e) => {
                    const q = e.currentTarget.dataset.query;
                    playerModal.style.display = 'none';
                    loadAndSelectAudioTab(q);
                });

                container.appendChild(row);
            });

            modalMediaContainer.innerHTML = '';
            modalMediaContainer.appendChild(container);

        } catch (err) {
            modalMediaContainer.innerHTML = '<div style="color:var(--danger)">Failed to load tracklist</div>';
        }
    }

    async function fetchDeezerCharts() {
        try {
            const res = await fetch('/api/deezer/charts');
            const data = await res.json();
            if (data.tracks) renderDeezerTracks(data.tracks);
        } catch (e) {
            console.error('Failed to fetch music charts:', e);
        }
    }

    async function searchDeezer() {
        const query = deezerSearchInput.value.trim();
        if (!query) return fetchDeezerCharts();
        
        deezerSearchBtn.disabled = true;
        try {
            const res = await fetch(`/api/deezer/search?q=${encodeURIComponent(query)}`);
            const data = await res.json();
            if (data.tracks) renderDeezerTracks(data.tracks);
        } catch (e) {
            showToast('Music search failed', 'error');
        } finally {
            deezerSearchBtn.disabled = false;
        }
    }

    function renderDeezerTracks(tracks) {
        deezerResultsGrid.innerHTML = '';
        if (!tracks || tracks.length === 0) {
            deezerResultsGrid.innerHTML = '<div class="empty-state">No music tracks found</div>';
            return;
        }

        tracks.forEach(track => {
            const card = document.createElement('div');
            card.className = 'deezer-card';
            card.innerHTML = `
                <div class="deezer-cover-wrapper">
                    <img src="${track.cover || ''}" alt="cover">
                </div>
                <div class="deezer-track-title">${track.title}</div>
                <div class="deezer-artist"><i class="fa-solid fa-user"></i> ${track.artist}</div>
                <div class="deezer-actions">
                    <button class="btn btn-sm btn-primary play-full-btn" data-query="${track.artist} ${track.title}" data-title="${track.title}" data-artist="${track.artist}">
                        <i class="fa-solid fa-fire-flame-curved"></i> Stream FULL
                    </button>
                    <button class="btn btn-sm btn-glass direct-mp3-btn" data-query="${track.artist} ${track.title}" data-title="${track.artist} - ${track.title}">
                        <i class="fa-solid fa-download"></i> Direct MP3
                    </button>
                    <button class="btn btn-sm btn-glass load-dl-btn" data-query="${track.artist} ${track.title}">
                        <i class="fa-solid fa-sliders"></i> Options
                    </button>
                </div>
            `;

            card.querySelector('.play-full-btn').addEventListener('click', async (e) => {
                const btn = e.currentTarget;
                const q = btn.dataset.query;
                const title = btn.dataset.title;
                const artist = btn.dataset.artist;

                btn.disabled = true;
                showToast(`Fetching full stream for ${artist} - ${title}...`, 'info');

                try {
                    const res = await fetch(`/api/stream-full?q=${encodeURIComponent(q)}`);
                    const data = await res.json();
                    if (data.error || !data.stream_url) throw new Error(data.error || 'Stream URL not available');

                    playMediaModal(data.stream_url, `🔥 FULL Stream (${data.duration_str}): ${artist} - ${title}`);
                    showToast('Streaming full track!', 'success');
                } catch (err) {
                    showToast(err.message, 'error');
                } finally {
                    btn.disabled = false;
                }
            });

            card.querySelector('.direct-mp3-btn').addEventListener('click', (e) => {
                const btn = e.currentTarget;
                downloadDirectMP3(btn.dataset.query, btn.dataset.title);
            });

            card.querySelector('.load-dl-btn').addEventListener('click', (e) => {
                const q = e.currentTarget.dataset.query;
                loadAndSelectAudioTab(q);
            });

            deezerResultsGrid.appendChild(card);
        });
    }

    // Direct 1-Click MP3 Downloader
    async function downloadDirectMP3(query, title) {
        showToast(`Starting 320kbps MP3 download: ${title || query}...`, 'info');
        activeDownloadsSection.style.display = 'block';
        activeDownloadsSection.scrollIntoView({ behavior: 'smooth' });

        try {
            const payload = {
                url: query.startsWith('http') ? query : `ytsearch1:${query}`,
                title: title || query,
                download_type: 'audio',
                audio_format: 'mp3',
                audio_quality: '320'
            };

            const res = await fetch('/api/download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error || 'Failed to start MP3 download');

            connectSSE(data.task_id, title || query, '');
            showToast('MP3 Download active!', 'success');

        } catch (err) {
            showToast(err.message, 'error');
        }
    }


    // Helper: Load track and auto switch tab to MP3
    async function loadAndSelectAudioTab(query) {
        urlInput.value = query;
        clearBtn.style.display = 'block';
        showToast(`Loading options for: ${query}...`, 'info');
        
        await fetchVideoInfo();

        const audioTab = document.querySelector('.tab-btn[data-tab="audio"]');
        if (audioTab) audioTab.click();

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Fetch Completed Downloads History
    async function fetchHistory() {
        try {
            const res = await fetch('/api/history');
            const data = await res.json();
            renderHistory(data);
        } catch (e) {
            console.error('Failed to fetch history:', e);
        }
    }

    function renderHistory(items) {
        historyGrid.innerHTML = '';
        if (!items || items.length === 0) {
            emptyHistory.style.display = 'block';
            historyGrid.appendChild(emptyHistory);
            return;
        }

        emptyHistory.style.display = 'none';

        items.forEach(item => {
            const card = document.createElement('div');
            card.className = 'history-card';
            card.innerHTML = `
                <div class="history-thumb-wrapper">
                    <img src="${item.thumbnail || ''}" alt="thumb">
                </div>
                <div class="history-title">${item.title}</div>
                <div class="meta-pill" style="align-self: flex-start;">
                    <i class="fa-solid fa-file"></i> ${item.file_size_str || 'File'}
                </div>
                <div class="history-actions">
                    <a href="${item.file_url}" class="btn btn-sm btn-primary" style="flex:1; text-decoration:none;" download>
                        <i class="fa-solid fa-download"></i> Save
                    </a>
                    <button class="btn btn-sm btn-glass play-media-btn" data-url="/api/stream/${item.filename}" data-title="${item.title}">
                        <i class="fa-solid fa-play"></i> Play
                    </button>
                    <button class="btn btn-sm btn-glass iphone-media-btn" data-filename="${item.filename}" data-title="${item.title}" title="Transfer to iPhone">
                        <i class="fa-brands fa-apple" style="color:#00f2fe;"></i> iPhone
                    </button>
                </div>
            `;

            card.querySelector('.play-media-btn').addEventListener('click', (e) => {
                const streamUrl = e.currentTarget.dataset.url;
                const title = e.currentTarget.dataset.title;
                playMediaModal(streamUrl, title);
            });

            card.querySelector('.iphone-media-btn').addEventListener('click', (e) => {
                const btn = e.currentTarget;
                openIphoneTransferModal(btn.dataset.filename, btn.dataset.title);
            });

            historyGrid.appendChild(card);
        });
    }

    async function openIphoneTransferModal(filename, title) {
        showToast('Generating iPhone QR Transfer Code...', 'info');
        try {
            const res = await fetch('/api/network-info');
            const data = await res.json();
            const localIp = data.local_ip || window.location.hostname;
            
            let fileUrl = `http://${localIp}:5050`;
            if (filename) {
                fileUrl += `/api/files/${encodeURIComponent(filename)}`;
                iphoneFileTitle.textContent = `🎵 ${title || filename}`;
            } else {
                iphoneFileTitle.textContent = `📱 Scan to access NovaStream App on iPhone`;
            }

            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(fileUrl)}`;
            qrCodeImg.src = qrUrl;
            iphoneDirectUrl.value = fileUrl;
            iphoneModal.style.display = 'flex';
        } catch (e) {
            showToast('Failed to load network info for QR code', 'error');
        }
    }

    function playMediaModal(url, title) {
        modalTitle.textContent = title;
        const isAudio = url.endsWith('.mp3') || url.endsWith('.m4a') || url.endsWith('.flac') || url.endsWith('.wav');
        if (isAudio) {
            modalMediaContainer.innerHTML = `<audio controls autoplay src="${url}"></audio>`;
        } else {
            modalMediaContainer.innerHTML = `<video controls autoplay src="${url}"></video>`;
        }
        playerModal.style.display = 'flex';
    }

    // Helper Toast
    function showToast(msg, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';
        toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${msg}</span>`;
        toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    function formatDate(dateStr) {
        if (!dateStr || dateStr.length !== 8) return dateStr;
        return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
    }
});
