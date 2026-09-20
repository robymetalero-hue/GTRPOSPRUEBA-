const fs = require('fs');
let content = fs.readFileSync('src/context/AppContext.tsx', 'utf8');

const useE = `
    // Global WebSocket connection for settings/alerts
    useEffect(() => {
        if (!user || user.username === 'none') return;

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = \`\${protocol}//\${window.location.host}/alerts\`;
        
        let socket = null;
        let reconnectTimeout = null;

        const connect = () => {
            socket = new WebSocket(wsUrl);

            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'kiosk_mode_changed') {
                        setKioskMode(data.kiosk_mode);
                        localStorage.setItem('kioskMode', String(data.kiosk_mode));
                        if (data.kiosk_mode) {
                            showNotification("Modo Quiosco ha sido activado por el administrador.", "info");
                        } else {
                            showNotification("Modo Quiosco ha sido desactivado.", "info");
                        }
                    }
                } catch (err) { }
            };

            socket.onclose = () => {
                reconnectTimeout = setTimeout(connect, 10000);
            };

            socket.onerror = () => {};
        };

        connect();

        return () => {
            if (socket) socket.close();
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
        };
    }, [user?.id, user?.username]);
`;

content = content.replace('// Auto trigger sync when the system transitions to online', useE + '\n\n    // Auto trigger sync when the system transitions to online');

fs.writeFileSync('src/context/AppContext.tsx', content);
