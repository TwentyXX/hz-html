const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 静的ファイルを提供
app.use(express.static(path.join(__dirname)));

// ルートパスでindex.htmlを提供
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// サーバー起動
app.listen(PORT, () => {
    console.log(`サーバーが起動しました: http://localhost:${PORT}`);
    console.log('Ctrl+C で停止します');
});

// グレースフルシャットダウン
process.on('SIGINT', () => {
    console.log('\nサーバーを停止しています...');
    process.exit(0);
});
