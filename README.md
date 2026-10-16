# 楓嶺 · 回音鐘 Maple Ridge

像素風(three.js 低解析度渲染 + 描邊)的解謎探險遊戲。回到過世爺爺的楓嶺,推石頭、釣魚、修水車、點古燈、闖山洞,登頂敲響回音鐘。

- 純靜態網站,不需 build:three@0.170.0 由 CDN import map 載入,直接部署到 Vercel(Framework: Other,Output: 根目錄)。
- 所有美術(地形、樹、房子、角色)與音樂音效都是程式即時生成。
- 本機測試:`python -m http.server` 後開 `http://localhost:8000`。

操作:WASD/方向鍵 移動 · E/空白 互動、推石 · Shift 奔跑(取得跑鞋後)· Tab/J 手帳 · R 重置謎題 · Z 望遠鏡 · M 音樂開關。手機有虛擬搖桿。

`tools/` 內是設計用的 Sokoban 解題器(驗證推石謎題可解)與地圖 ASCII 輸出。

## 測試
網址加上 `?debug` 會載入 `src/debug.js`(`window.D`):`D.go(x,z)` 走路、`D.press()` 互動、`D.talk()` 跳過對話、`D.soko(moves,c0,r0,cave)` 依解題器步驟推石。整條主線(信箱→貓→釣魚→工具棚→推石→溪流謎題→營地→梯子→水車→升降台→古燈→山洞謎題→鐘槌→山頂敲鐘)已用它跑過一遍。
