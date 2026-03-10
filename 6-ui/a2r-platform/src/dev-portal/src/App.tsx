import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Docs from './pages/Docs';
import ApiExplorer from './pages/ApiExplorer';
import Templates from './pages/Templates';
import PublishGuide from './pages/PublishGuide';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/docs" element={<Docs />} />
        <Route path="/docs/:section" element={<Docs />} />
        <Route path="/api" element={<ApiExplorer />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/publish" element={<PublishGuide />} />
      </Routes>
    </Layout>
  );
}

export default App;
