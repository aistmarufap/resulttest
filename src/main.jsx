import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import {
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom";
import Resultzone from './pages/Resultzone.jsx';
import Result from './pages/result.jsx';
const router = createBrowserRouter([
  {
    path: "/",
    element: <Resultzone />,
  },
  {
    path: "/result",
    element: <Result />,
  },
  {
    path: "/test",
    element: <App />,
  },
]);
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
)
