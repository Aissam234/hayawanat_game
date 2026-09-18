import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        
        # Context 1: Host
        context1 = await browser.new_context()
        page1 = await context1.new_page()
        await page1.goto('http://localhost:5173')
        
        # Create Room
        # Click "Create Room" main button
        await page1.click('text=✨ إنشاء غرفة')
        await page1.fill('input[placeholder="أدخل اسمك…"]', 'HostUser')
        await page1.click('text=🎮 إنشاء وبدء')
        
        # Wait for lobby and get code
        await page1.wait_for_selector('text=كود الغرفة')
        # Room code is in a span with font-mono class
        room_code_el = await page1.wait_for_selector('.font-mono')
        room_code = await room_code_el.inner_text()
        print(f"Room created with code: {room_code}")
        
        # Wait for connection
        await page1.wait_for_selector('text=متصل')

        # Context 2: Guest
        context2 = await browser.new_context()
        page2 = await context2.new_page()
        await page2.goto('http://localhost:5173')
        
        # Guest Join
        await page2.click('text=🚪 الانضمام إلى غرفة')
        await page2.fill('input[placeholder="أدخل اسمك…"]', 'GuestUser')
        await page2.fill('input[placeholder="مثال: K7F4Q"]', room_code)
        await page2.click('text=🚀 انضمام')
        
        # Wait for guest to reach lobby
        await page2.wait_for_selector('text=متصل')
        print("Guest joined successfully.")
        
        # Wait for Host to see Guest
        await page1.wait_for_selector('text=GuestUser')
        
        # Host: set players
        await page1.select_option('text=اللاعب الأول >> xpath=following-sibling::select', label='HostUser 👑')
        await page1.select_option('text=اللاعب الثاني >> xpath=following-sibling::select', label='GuestUser ')
        
        # Start Round
        await page1.click('text=ابدأ الجولة!')
        
        # Verify Game Page for both
        await page1.wait_for_selector('text=لعبة الحيوانات')
        await page2.wait_for_selector('text=لعبة الحيوانات')
        print("Round started successfully in both clients.")
        
        # Host: Cancel Round
        await page1.click('button:has-text("إلغاء الجولة")')
        # Confirm Modal
        await page1.click('button:has-text("إلغاء الجولة")')
        
        # Verify both back in lobby
        await page1.wait_for_selector('text=غرفة الانتظار')
        await page2.wait_for_selector('text=غرفة الانتظار')
        print("Round cancelled successfully.")
        
        # Host: Close Room
        await page1.click('text=إعدادات الغرفة')
        await page1.click('button:has-text("إغلاق الغرفة")')
        
        # Verify Guest is redirected to home and sees error/toast
        await page2.wait_for_selector('text=أنشئ غرفة أو انضم لغرفة موجودة')
        print("Room closed successfully, users redirected home.")
        
        await browser.close()
        print("Test passed successfully!")

if __name__ == '__main__':
    asyncio.run(main())
