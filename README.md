# 楓嶺 · 回音鐘 Maple Ridge

像素風(three.js 低解析度渲染 + 描邊)的解謎探險遊戲。回到過世爺爺的楓嶺,推石頭、釣魚、修水車、點古燈、闖山洞,登頂敲響回音鐘。

- 純靜態網站,不需 build:three@0.170.0 由 CDN import map 載入,直接部署到 Vercel(Framework: Other,Output: 根目錄)。
- 所有美術(地形、樹、房子、角色)與音樂音效都是程式即時生成。
- 本機測試:`python -m http.server` 後開 `http://localhost:8000`。

操作:WASD/方向鍵 移動 · E/空白 互動、推石 · Shift 奔跑(取得跑鞋後)· Tab/J 手帳 · R 重置謎題 · Z 望遠鏡 · M 音樂開關。手機有虛擬搖桿。

`tools/` 內是設計用的 Sokoban 解題器(驗證推石謎題可解)與地圖 ASCII 輸出。
