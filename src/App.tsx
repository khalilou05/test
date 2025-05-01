import { RootState, AppDispatch } from "./store"; // Import AppDispatch
import Header from "./components/Header";
import {  useRef, useEffect } from "react"; // Added useEffect
import Sidebar from "./components/Sidebar";
import { toggleSidebar } from "./store/sidebarSlice";
import { useDispatch, useSelector } from "react-redux";
import EditorPreview, { EditorPreviewRef } from "./components/EditorPreview";

const App = () => {
  const dispatch: AppDispatch = useDispatch();
  const isSidebarOpen = useSelector((state: RootState) => state.sidebar.open);
  const checkout = useSelector((state: RootState) => state.checkout); // Get checkout state
  const editorPreviewRef = useRef<EditorPreviewRef | null>(null);

  const handleToggleSidebar = () => {
    dispatch(toggleSidebar());
  };

  // Effect to potentially reset checkout state when navigating away from success state
  useEffect(() => {
      // If payment was successful but export hasn't triggered (e.g., user navigated away)
      // or if payment failed, reset the state so they can try again or edit.
      // This depends on the desired UX flow.
      // For simplicity, let's assume EditorPreview handles the export trigger.
      // We might reset the checkout state when the component unmounts (in Checkout.tsx) or here based on navigation.
      // Let's keep it simple: EditorPreview triggers export on success flag.
      // We don't need extra logic here for now.
  }, [checkout.paymentSucceeded]);

  // Bloquer le zoom navigateur globalement (Ctrl + roulette souris)
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    };
    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      window.removeEventListener("wheel", handleWheel);
    };
  }, []);

  return (
    <div className="flex flex-col w-full h-screen bg-[#111]">
      <Header
        toggleSidebar={handleToggleSidebar}
        isSidebarOpen={isSidebarOpen}
      />
      <div className="flex-1 flex overflow-hidden"> {/* Main content area */}
        {/* Sidebar - Conditionally rendered based on route? No, kept always for editor */}
         <Sidebar isSidebarOpen={isSidebarOpen} mapEditorRef={editorPreviewRef} />

        {/* Main Editor Preview Area */}
        <main className="flex-auto flex flex-col h-full w-full min-h-0 min-w-0 overflow-hidden"> {/* Ensure main takes remaining space */}
          <div className="flex-auto flex flex-col h-full w-full items-center relative z-10 overflow-auto min-h-0 min-w-0 scrollbar-thin scrollbar-thumb-[#333] scrollbar-track-[#222] p-5"> {/* Added padding */}
            <div className="flex-none m-auto"> {/* Center the preview */}
              <EditorPreview
                ref={editorPreviewRef}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;