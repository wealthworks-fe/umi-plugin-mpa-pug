import styles from './index.css';

function App() {
  return (
    <div className={styles.normal}>
      <h1>Page index 123</h1>
      <img src={require('../img/logo.png')} alt="logo"/>
    </div>
  );
}

require('react-dom').render(<App />, document.getElementById('app'));
