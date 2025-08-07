document.addEventListener('deviceready', () => {
    const input = document.getElementById('apiUrl');
    const button = document.getElementById('fetchBtn');
    const status = document.getElementById('status');

    const texts = {
        default: 'ارسال',
        loading: 'در حال بارگذاری...',
        success: 'انجام شد!',
        emptyInput: 'لطفا لینک را وارد کنید',
        networkError: 'اتصال اینترنت را بررسی کنید',
        apiError: 'لینک وارد شده نادرست است'
    };

    function setButtonState(state) {
        button.textContent = texts[state];
        switch(state) {
            case 'loading':
                button.disabled = true;
                status.textContent = '';
                break;
            case 'success':
                button.disabled = false;
                status.textContent = '';
                break;
            case 'emptyInput':
            case 'networkError':
            case 'apiError':
                button.disabled = false;
                status.textContent = texts[state];
                break;
            default:
                button.disabled = false;
                status.textContent = '';
                break;
        }
    }

    async function fetchData(url) {
        try {
            const cleanedUrl = url.replace('/view/raw/', '/view/');
            const response = await fetch(cleanedUrl);
            if (!response.ok) throw new Error('api_error');
            const data = await response.json();

            if (!data?.JWT || typeof data.JWT !== 'string' || data.JWT.trim() === '') {
                throw new Error('api_error');
            }
            return data.JWT;
        } catch (err) {
            if (err.message === 'Failed to fetch' || err.message === 'NetworkError when attempting to fetch resource.') {
                throw new Error('network_error');
            }
            throw err;
        }
    }

    button.addEventListener('click', async () => {
        const url = input.value.trim();
        if (!url) {
            setButtonState('emptyInput');
            return;
        }

        setButtonState('loading');

        try {
            const jwt = await fetchData(url);

            // Decode the JWT or parse the domain from the input URL to decide scenario
            // Actually, token is JSON stringified. Let's parse inside index.js.
            let jwtData;
            try {
                jwtData = JSON.parse(jwt);
            } catch {
                // Cannot parse JWT JSON payload, treat as error
                setButtonState('apiError');
                return;
            }

            // Decide domain type - based on user's current input link or ask user for domain?
            // Since in Chrome extension it picks current tab domain, here we must ask user for domain or infer it from the API url.

            // We'll infer from the cleaned URL hostname:
            let domain;
            try {
                const u = new URL(url);
                domain = u.hostname;
            } catch {
                setButtonState('apiError');
                return;
            }

            // Open the login.html with parameters for domain and JWT string (encoded)
            const params = new URLSearchParams();
            params.append('domain', domain);
            params.append('jwt', encodeURIComponent(jwt));

            // Open login page (internal)
            window.location.href = `login.html?${params.toString()}`;

        } catch (error) {
            if (error.message === 'network_error') {
                setButtonState('networkError');
            } else {
                setButtonState('apiError');
            }
        }
    });

    setButtonState('default');
});
