import { Loader } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { UI } from "./components/UI";
import { Experience } from "./components/Experience";

function App() {
    return (
        <>
            <UI />
            <Canvas
                shadows
                camera={{ position: [-0.5, 1, 4], fov: 45 }}
            >
                <Suspense fallback={null}>
                    <Experience />
                </Suspense>
            </Canvas>
            <Loader />
        </>
    );
}

export default App;
