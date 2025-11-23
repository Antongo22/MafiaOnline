import { FetchPage } from "./pages/FetchPage.tsx";

function App() {
  return (
    <>
      <FetchPage url="https://jsonplaceholder.typicode.com/todos/1" />
    </>
  );
}

export default App;