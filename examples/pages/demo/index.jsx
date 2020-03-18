import styles from './index.css';

function App() {
  return (
    <div className={styles.normal}>
      <h1>Page index</h1>
      <img src={require('./icon.svg')} alt="svg" />
    </div>
  );
}

require('react-dom').render(<App />, document.getElementById('root'));
