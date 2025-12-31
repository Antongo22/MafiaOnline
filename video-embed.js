/**
 * VideoCallsEmbed - Модуль для встраивания видеозвонков в любой блок на странице
 * 
 * Использование:
 * 
 * <div id="video-container"></div>
 * <script src="https://cdn.jsdelivr.net/npm/livekit-client@2.5.8/dist/livekit-client.umd.min.js"></script>
 * <script src="video-embed.js"></script>
 * <script>
 *   const embed = new VideoCallsEmbed({
 *     containerId: 'video-container',
 *     apiUrl: 'https://calls.trexon.ru/api',
 *     roomName: 'my-room',
 *     participantName: 'John Doe',
 *     width: '100%',
 *     height: '400px'
 *   });
 *   embed.connect();
 * </script>
 */

class VideoCallsEmbed {
    constructor(options) {
        this.options = {
            containerId: options.containerId || 'video-container',
            apiUrl: options.apiUrl || 'https://calls.trexon.ru/api',
            apiKey: options.apiKey || null,
            roomName: options.roomName,
            participantName: options.participantName,
            width: options.width || '100%',
            height: options.height || '400px',
            autoConnect: options.autoConnect !== false,
            showControls: options.showControls !== false,
            layout: options.layout || 'grid', // 'grid' or 'speaker'
            onConnected: options.onConnected || null,
            onDisconnected: options.onDisconnected || null,
            onParticipantJoined: options.onParticipantJoined || null,
            onParticipantLeft: options.onParticipantLeft || null,
            onError: options.onError || null
        };

        this.container = document.getElementById(this.options.containerId);
        if (!this.container) {
            throw new Error(`Container with id "${this.options.containerId}" not found`);
        }

        this.room = null;
        this.token = null;
        this.participants = new Map();

        this.init();
    }

    init() {
        // Create container structure
        this.container.style.width = this.options.width;
        this.container.style.height = this.options.height;
        this.container.style.position = 'relative';
        this.container.style.backgroundColor = '#000';
        this.container.style.borderRadius = '8px';
        this.container.style.overflow = 'hidden';

        // Create video grid
        this.videoGrid = document.createElement('div');
        this.videoGrid.style.width = '100%';
        this.videoGrid.style.height = this.options.showControls ? 'calc(100% - 60px)' : '100%';
        this.videoGrid.style.display = 'grid';
        this.videoGrid.style.gap = '8px';
        this.videoGrid.style.padding = '8px';
        this.container.appendChild(this.videoGrid);

        // Create controls
        if (this.options.showControls) {
            this.controls = document.createElement('div');
            this.controls.style.position = 'absolute';
            this.controls.style.bottom = '0';
            this.controls.style.left = '0';
            this.controls.style.right = '0';
            this.controls.style.height = '60px';
            this.controls.style.background = 'rgba(0, 0, 0, 0.8)';
            this.controls.style.display = 'flex';
            this.controls.style.alignItems = 'center';
            this.controls.style.justifyContent = 'center';
            this.controls.style.gap = '10px';
            this.controls.style.padding = '0 20px';
            this.container.appendChild(this.controls);

            this.createControls();
        }

        // Auto connect if enabled
        if (this.options.autoConnect) {
            this.connect();
        }
    }

    createControls() {
        const buttonStyle = `
            padding: 10px 20px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            transition: background 0.2s;
        `;

        // Microphone button
        this.micButton = document.createElement('button');
        this.micButton.innerHTML = '🎤';
        this.micButton.style.cssText = buttonStyle;
        this.micButton.onclick = () => this.toggleMicrophone();
        this.controls.appendChild(this.micButton);

        // Camera button
        this.cameraButton = document.createElement('button');
        this.cameraButton.innerHTML = '📹';
        this.cameraButton.style.cssText = buttonStyle;
        this.cameraButton.onclick = () => this.toggleCamera();
        this.controls.appendChild(this.cameraButton);

        // Disconnect button
        this.disconnectButton = document.createElement('button');
        this.disconnectButton.innerHTML = '📞 Отключиться';
        this.disconnectButton.style.cssText = buttonStyle.replace('#667eea', '#dc3545');
        this.disconnectButton.onclick = () => this.disconnect();
        this.controls.appendChild(this.disconnectButton);
    }

    async connect() {
        try {
            // Get token from API
            const response = await fetch(`${this.options.apiUrl}/tokens`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.options.apiKey && { 'X-API-Key': this.options.apiKey })
                },
                body: JSON.stringify({
                    room_name: this.options.roomName,
                    participant_name: this.options.participantName,
                    can_publish: true,
                    can_subscribe: true,
                    can_publish_data: true
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to get token: ${response.status}`);
            }

            const data = await response.json();
            this.token = data.token;

            // Connect to LiveKit room
            this.room = new LivekitClient.Room({
                adaptiveStream: true,
                dynacast: true,
                // Automatically manage local tracks
                audioCaptureDefaults: {
                    autoGainControl: true,
                    echoCancellation: true,
                    noiseSuppression: true,
                },
                videoCaptureDefaults: {
                    resolution: LivekitClient.VideoPresets.h720.resolution,
                }
            });

            await this.room.connect(data.url, this.token);

            // Enable camera and microphone only if not already enabled
            if (!this.room.localParticipant.isCameraEnabled) {
                await this.room.localParticipant.setCameraEnabled(true);
            }
            if (!this.room.localParticipant.isMicrophoneEnabled) {
                await this.room.localParticipant.setMicrophoneEnabled(true);
            }

            // Setup event listeners
            this.setupEventListeners();

            // Initial render
            this.renderParticipants();

            if (this.options.onConnected) {
                this.options.onConnected(this.room);
            }

        } catch (error) {
            console.error('Failed to connect:', error);
            if (this.options.onError) {
                this.options.onError(error);
            }
        }
    }

    setupEventListeners() {
        this.room.on(LivekitClient.RoomEvent.ParticipantConnected, (participant) => {
            console.log('Participant connected:', participant.identity);
            // Small delay to ensure participant is added to the collection
            setTimeout(() => {
                this.renderParticipants();
                if (this.options.onParticipantJoined) {
                    this.options.onParticipantJoined(participant);
                }
            }, 100);
        });

        this.room.on(LivekitClient.RoomEvent.ParticipantDisconnected, (participant) => {
            console.log('Participant disconnected:', participant.identity);
            this.renderParticipants();
            if (this.options.onParticipantLeft) {
                this.options.onParticipantLeft(participant);
            }
        });

        this.room.on(LivekitClient.RoomEvent.TrackSubscribed, () => {
            this.renderParticipants();
        });

        this.room.on(LivekitClient.RoomEvent.TrackUnsubscribed, () => {
            this.renderParticipants();
        });

        this.room.on(LivekitClient.RoomEvent.TrackPublished, (publication, participant) => {
            console.log('Track published:', publication.kind, 'from', participant.identity);
            this.renderParticipants();
        });

        this.room.on(LivekitClient.RoomEvent.LocalTrackPublished, (publication) => {
            console.log('Local track published:', publication.kind);
            this.renderParticipants();
        });

        this.room.on(LivekitClient.RoomEvent.Disconnected, () => {
            console.log('Disconnected from room');
            if (this.options.onDisconnected) {
                this.options.onDisconnected();
            }
        });
    }

    renderParticipants() {
        if (!this.room) return;

        this.videoGrid.innerHTML = '';

        // Get remote participants from remoteParticipants property (Map)
        const remoteParticipants = this.room.remoteParticipants 
            ? Array.from(this.room.remoteParticipants.values()) 
            : (this.room.participants ? Array.from(this.room.participants.values()) : []);

        const allParticipants = [
            this.room.localParticipant,
            ...remoteParticipants
        ].filter(p => p); // Filter out undefined

        // Calculate grid layout
        const count = allParticipants.length;
        const cols = Math.ceil(Math.sqrt(count));
        this.videoGrid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

        allParticipants.forEach(participant => {
            if (!participant) return;

            const wrapper = document.createElement('div');
            wrapper.style.position = 'relative';
            wrapper.style.backgroundColor = '#1a1a1a';
            wrapper.style.borderRadius = '8px';
            wrapper.style.overflow = 'hidden';
            wrapper.style.aspectRatio = '16/9';

            const video = document.createElement('video');
            video.autoplay = true;
            video.playsInline = true;
            video.muted = participant.isLocal;
            video.style.width = '100%';
            video.style.height = '100%';
            video.style.objectFit = 'cover';

            const label = document.createElement('div');
            label.textContent = participant.identity + (participant.isLocal ? ' (Вы)' : '');
            label.style.position = 'absolute';
            label.style.bottom = '10px';
            label.style.left = '10px';
            label.style.background = 'rgba(0, 0, 0, 0.7)';
            label.style.color = 'white';
            label.style.padding = '5px 10px';
            label.style.borderRadius = '4px';
            label.style.fontSize = '12px';

            // Attach video track
            const trackPublications = participant.trackPublications || participant.videoTracks;
            if (trackPublications) {
                const publications = Array.from(trackPublications.values());
                const videoPublications = publications.filter(pub => pub.kind === 'video');
                const videoTrack = videoPublications.find(pub => pub.track);

                if (videoTrack && videoTrack.track) {
                    videoTrack.track.attach(video);
                }
            }

            // Attach audio track (for remote participants)
            if (!participant.isLocal && trackPublications) {
                const audioPublications = Array.from(trackPublications.values()).filter(pub => pub.kind === 'audio');
                const audioTrack = audioPublications.find(pub => pub.track);

                if (audioTrack && audioTrack.track) {
                    audioTrack.track.attach();
                }
            }

            wrapper.appendChild(video);
            wrapper.appendChild(label);
            this.videoGrid.appendChild(wrapper);
        });
    }

    async toggleMicrophone() {
        if (!this.room) return;
        const enabled = this.room.localParticipant.isMicrophoneEnabled;
        await this.room.localParticipant.setMicrophoneEnabled(!enabled);
        this.micButton.innerHTML = enabled ? '🔇' : '🎤';
    }

    async toggleCamera() {
        if (!this.room) return;
        const enabled = this.room.localParticipant.isCameraEnabled;
        await this.room.localParticipant.setCameraEnabled(!enabled);
        this.cameraButton.innerHTML = enabled ? '📷' : '📹';
    }

    disconnect() {
        if (this.room) {
            this.room.disconnect();
            this.room = null;
            this.videoGrid.innerHTML = '<div style="color: white; text-align: center; padding: 50px;">Отключено</div>';
        }
    }

    // Public API methods
    getRoom() {
        return this.room;
    }

    getParticipants() {
        if (!this.room) return [];
        return [
            this.room.localParticipant,
            ...(this.room.participants ? Array.from(this.room.participants.values()) : [])
        ].filter(p => p);
    }

    isConnected() {
        return this.room && this.room.state === 'connected';
    }
}

// Export for use in browser
if (typeof window !== 'undefined') {
    window.VideoCallsEmbed = VideoCallsEmbed;
}
