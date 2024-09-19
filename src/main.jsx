import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import {
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom";
import Resultzone from './pages/Resultzone.jsx';
const router = createBrowserRouter([
  {
    path: "/",
    element: <Resultzone />,
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
