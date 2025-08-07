document.addEventListener('deviceready', () => {
  const messageEl = document.getElementById('message');

  // Parse URL params
  const params = new URLSearchParams(window.location.search);
  const encodedJwt = params.get('jwt');
  const domain = params.get('domain');

  if (!encodedJwt || !domain) {
    messageEl.textContent = 'اطلاعات ورود ناقص است.';
    return;
  }

  const jwtString = decodeURIComponent(encodedJwt);

  // Prepare URLs
  const mDomain = 'm.snappfood.ir';
  const foodDomain = 'food.snapp.ir';

  async function clearCookiesForDomain(browserRef, domainToClear) {
    // No Cordova API to clear cookies directly for InAppBrowser.
    // As workaround, navigate to blank, inject script to delete cookies.
    // We'll inject JS to delete all document.cookie entries.
    return new Promise((resolve) => {
      const deleteCookiesScript = `
        (function() {
          var cookies = document.cookie.split("; ");
          for (var i=0; i<cookies.length; i++) {
            var d = window.location.hostname.split(".");
            while(d.length > 0) {
              var cookieBase = encodeURIComponent(cookies[i].split(";")[0].split("=")[0]) + 
                '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; domain=' + d.join('.') + ' ;path=';
              var p = location.pathname.split('/');
              document.cookie = cookieBase + '/';
              while(p.length > 0) {
                document.cookie = cookieBase + p.join('/');
                p.pop();
              };
              d.shift();
            }
          }
          return true;
        })();
        true;
      `;
      browserRef.executeScript(
        { code: deleteCookiesScript },
        () => resolve()
      );
    });
  }

  async function setCookies(browserRef, cookieUrl, jwtData) {
    // Cordova's InAppBrowser does NOT provide API to set cookies directly.
    // Alternative is injecting document.cookie inside the InAppBrowser via executeScript.
    // Format:
    // document.cookie = "name=value; path=/; domain=example.com; expires=d.toUTCString()";
    const expireDate = new Date();
    expireDate.setSeconds(expireDate.getSeconds() + jwtData.expires_in || 3600);
    const expireStr = expireDate.toUTCString();

    const cookies = [
      `jwt-access_token=${jwtData.access_token}; path=/; domain=${cookieUrl}`,
      `jwt-token_type=${jwtData.token_type}; path=/; domain=${cookieUrl}`,
      `jwt-refresh_token=${jwtData.refresh_token}; path=/; domain=${cookieUrl}`,
      `jwt-expires_in=${jwtData.expires_in}; path=/; domain=${cookieUrl}`,
      `UserMembership=0; path=/; domain=${cookieUrl}`
    ];

    for (const cookie of cookies) {
      const cookieStr = `${cookie}; expires=${expireStr}; SameSite=Lax; secure`;
      await new Promise(res => {
        browserRef.executeScript({ code: `document.cookie = "${cookieStr}";` }, res);
      });
    }
  }

  function parseJwt(jwt) {
    try {
      return JSON.parse(jwt);
    } catch {
      return null;
    }
  }

  async function handleMsnappfood() {
    messageEl.textContent = 'در حال تنظیم کوکی‌ها و ورود به m.snappfood.ir...';

    const jwtData = parseJwt(jwtString);
    if (!jwtData) {
      messageEl.textContent = 'توکن JWT نامعتبر است.';
      return;
    }

    const loginUrl = 'https://m.snappfood.ir/';

    // Open InAppBrowser
    const browserRef = cordova.InAppBrowser.open(loginUrl, '_blank', 'location=no,clearcache=yes,clearsessioncache=yes');

    browserRef.addEventListener('loadstop', async () => {
      try {
        // Clear cookies by injecting script:
        await clearCookiesForDomain(browserRef, mDomain);
        await clearCookiesForDomain(browserRef, '.snappfood.ir');

        // Set the cookies
        await setCookies(browserRef, mDomain, jwtData);

        // Reload to apply cookies
        browserRef.executeScript({ code: 'location.reload();' });
        messageEl.textContent = 'ورود موفقیت‌آمیز بود!';
      } catch (e) {
        messageEl.textContent = 'خطا در تنظیم کوکی‌ها.';
      }
    });

    // On exit (close) of InAppBrowser:
    browserRef.addEventListener('exit', () => {
      messageEl.textContent = 'این صفحه بسته شد.';
    });
  }

  async function handleFoodsnapp() {
    messageEl.textContent = 'در حال ورود به food.snapp.ir و تنظیم localStorage...';

    const loginUrl = 'https://food.snapp.ir/';

    const browserRef = cordova.InAppBrowser.open(loginUrl, '_blank', 'location=no,clearcache=yes,clearsessioncache=yes');

    browserRef.addEventListener('loadstop', async () => {
      try {
        // Clear localStorage keys: state, user-info
        await new Promise(res => {
          browserRef.executeScript({
            code: `
              localStorage.removeItem('state'); 
              localStorage.removeItem('user-info');
              true;
            `
          }, res);
        });

        // Set the JWT in localStorage
        await new Promise(res => {
          browserRef.executeScript({
            code: `
              localStorage.setItem('JWT', \`${jwtString}\`);
              true;
            `
          }, res);
        });

        // Reload page
        browserRef.executeScript({ code: 'location.reload();' });
        messageEl.textContent = 'ورود موفقیت‌آمیز بود!';
      } catch (e) {
        messageEl.textContent = 'خطا در تنظیم localStorage.';
      }
    });

    browserRef.addEventListener('exit', () => {
      messageEl.textContent = 'این صفحه بسته شد.';
    });
  }

  // Determine scenario
  if (domain.includes(mDomain)) {
    handleMsnappfood();
  } else if (domain.includes(foodDomain)) {
    handleFoodsnapp();
  } else {
    messageEl.textContent = 'دامنه پشتیبانی نشده است.';
  }
});
