const injectEruda = () => {
  document.write(`
    <script crossorigin='anonymous' src='//fe-public.licaigc.com/libs/eruda/1.5.4/eruda.min.js'><\/script>
    <script>eruda.init();<\/script>
  `);
};

window.lcgcDebugModeCount = 0;
window.lcgcDebugClickTime = Date.parse(new Date());
const isDebugMode = !!localStorage.getItem('lcgcDebugMode');
if (isDebugMode) {
  injectEruda();
}
document.addEventListener('click', event => {
  if (event.clientX < 50 && event.clientY < 50) {
    const current = Date.parse(new Date());
    if (current - window.lcgcDebugClickTime <= 1000) {
      // 连续点击十次唤起
      window.lcgcDebugModeCount += 1;
      if (window.lcgcDebugModeCount >= 10) {
        localStorage.setItem('lcgcDebugMode', true);
        window.location.reload();
      }
    } else {
      window.lcgcDebugModeCount = 0;
    }
    window.lcgcDebugClickTime = current;
  }
});
