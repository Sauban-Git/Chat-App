import "./App.css";
import { useWebSocket } from "./customHooks/useWebSocket";
import { Home } from "./pages/Home";

function App() {
  useWebSocket();
  return <Home />;
}

export default App;
