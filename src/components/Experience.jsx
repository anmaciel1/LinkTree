import { Environment, Float, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { useEffect, useState } from "react";
import { Book } from "./Book";

function getCameraDistance(aspect) {
    if (aspect < 0.55) return 7.5;
    if (aspect < 0.75) return 6;
    if (aspect < 1.0) return 5;
    return 4;
}

export const Experience = () => {
    const [aspect, setAspect] = useState(() =>
        typeof window !== "undefined" ? window.innerWidth / window.innerHeight : 1.5
    );

    useEffect(() => {
        const onResize = () => setAspect(window.innerWidth / window.innerHeight);
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    const z = getCameraDistance(aspect);
    const x = aspect < 0.9 ? 0 : -0.5;

    return (
        <>
            <PerspectiveCamera makeDefault position={[x, 1, z]} fov={45} />
            <Float
                rotation-x={-Math.PI / 4}
                floatIntensity={1}
                speed={1}
                rotationIntensity={1}
            >

                <Book />
            </Float>
            <OrbitControls enablePan={false} minDistance={3} maxDistance={12} />
            <Environment preset="apartment"></Environment>
            <directionalLight
                position={[2, 5, 2]}
                intensity={0}
                castShadow
                shadow-mapSize-width={2048}
                shadow-mapSize-height={2048}
                shadow-bias={-0.0001}
            />
            <mesh position-y={-1.5} rotation-x={-Math.PI / 2} receiveShadow>
                <planeGeometry args={[100, 100]} />
                <shadowMaterial transparent opacity={0.2} />
            </mesh>
        </>
    );
};
