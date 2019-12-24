import './index.css';
import { add, sub } from '@package/index.js';

console.log(add(1, 2));
console.log(sub(1, 2));

function App() {
  return (
    <div className="normal">
      <h1>Page index 123</h1>
      <img src={require('../img/logo.png')} alt="logo" />
    </div>
  );
}

require('react-dom').render(<App />, document.getElementById('app'));
