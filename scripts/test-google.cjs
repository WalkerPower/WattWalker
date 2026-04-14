const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    
    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.log(`PAGE ERROR: "${msg.text()}"`);
        }
    });

    try {
        await page.goto('http://localhost:3000');
        
        // Wait for the Google sign-in button and click it
        console.log('Clicking Google Sign In...');
        // Find button that contains "Google" text
        const googleBtn = page.locator('button', { hasText: /Google|Sign in with Google/i }).first();
        await googleBtn.click();
        
        await page.waitForTimeout(3000);
        let errorText = await page.locator('.bg-red-50').textContent().catch(()=>null);
        if (errorText) {
            console.log('UI ERROR DISPLAYED (Google):', errorText);
        } else {
            console.log('No error displayed for Google.');
        }

    } catch(err) {
        console.log('Script error:', err.message);
    } finally {
        await browser.close();
    }
})();
