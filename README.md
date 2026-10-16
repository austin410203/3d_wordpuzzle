# 楓嶺 · 回音鐘 Maple Ridge

像素風(three.js 低解析度渲染 + 描邊)的解謎探險遊戲。回到過世爺爺的楓嶺,推石頭、釣魚、修水車、點古燈、闖山洞,登頂敲響回音鐘。

- 純靜態網站,不需 build:three@0.170.0 由 CDN import map 載入,直接部署到 Vercel(Framework: Other,Output: 根目錄)。
- 地形、樹、房子、角色由程式即時生成;對話頭像與道具圖示用 Gemini 生成(assets/portraits、assets/items,原圖在 art_src/);配樂 4 首用 Suno v6-mini 生成(assets/music:村莊、山徑、山洞、結局),音效為程式合成。
- 本機測試:`python -m http.server` 後開 `http://localhost:8000`。

操作:WASD/方向鍵 移動 · Shift 奔跑 · E/空白 互動、推石、上下車 · Tab/M 地圖 · B 背包 · J 旅程 · P 狗哨 · H 喇叭 · R 重置謎題 · Z 望遠鏡。手機:左半邊浮動搖桿 + E/跑/圖/包 按鈕。

系統:7 間可進入的房子(爺爺的家、阿梅雜貨店、工具棚、磨坊、老陳小屋、兩間山屋)、柴犬豆豆(餵食收養、跟隨、嗅出金楓葉、挖寶)、爺爺的小貨車「小藍」(鑰匙在爺爺書桌抽屜)、背包與採集(松果/野莓/香菇/狗餅乾/魚)。角色是體素 mini-fig 風格,對話頭像是像素畫。

`tools/` 內是設計用的 Sokoban 解題器(驗證推石謎題可解)與地圖 ASCII 輸出。

## 測試
網址加上 `?debug` 會載入 `src/debug.js`(`window.D`):`D.go(x,z)` 走路、`D.press()` 互動、`D.talk()` 跳過對話、`D.soko(moves,c0,r0,cave)` 依解題器步驟推石。整條主線(信箱→貓→釣魚→工具棚→推石→溪流謎題→營地→梯子→水車→升降台→古燈→山洞謎題→鐘槌→山頂敲鐘)已用它跑過一遍。
