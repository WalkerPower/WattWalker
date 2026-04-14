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
    
    page.on('pageerror', error => {
        console.log(`UNCAUGHT ERROR: "${error.message}"`);
    });

    try {
        await page.goto('http://localhost:3000');
        
        // Wait for inputs
        await page.waitForSelector('input[type="email"]');
        await page.fill('input[type="email"]', 'test@test.com');
        await page.fill('input[type="password"]', 'password123');
        
        await page.click('button[type="submit"]');
        
        // Wait for potential error div
        await page.waitForTimeout(3000);
        const errorText = await page.locator('.bg-red-50').textContent();
        if (errorText) {
            console.log('UI ERROR DISPLAYED:', errorText);
        }
    } catch(err) {
        console.log('Script error:', err.message);
    } finally {
        await browser.close();
    }
})();
