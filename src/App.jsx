import { Loader } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { UI } from "./components/UI";

function App() {
    return (
        <>
            <UI />
            <Loader />
        </>
    );
}

export default App;
