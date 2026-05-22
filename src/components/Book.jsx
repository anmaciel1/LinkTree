import { useMemo, useRef } from "react";
import { pages } from "./UI";
import {
    BoxGeometry,
    Float32BufferAttribute,
    Skeleton,
    SkinnedMesh,
    Uint16BufferAttribute,
    Vector3,
    Bone,
    MeshStandardMaterial,
    SRGBColorSpace,
} from "three";
import { useTexture } from "@react-three/drei";

// https://threejs.org/docs/#BoxGeometry
const pageWidth = 1.28;
const pageHeight = 1.78;
const pageDepth = 0.005;
const pageSegments = 30;
const segmentWidth = pageWidth / pageSegments;

const whiteColor = "#ffffff";

const pageGeometry = new BoxGeometry(
    pageWidth,
    pageHeight,
    pageDepth,
    pageSegments,
    2
);

pageGeometry.translate(pageWidth / 2, 0, 0); // half to left
const position = pageGeometry.attributes.position;

const vertex = new Vector3();
const skinIndex = []; // bones
const skinWeights = []; // renamed: avoids shadowing by the loop variable

for (let i = 0; i < position.count; i++) {
    vertex.fromBufferAttribute(position, i);
    const x = vertex.x;

    const boneIndex = Math.max(0, Math.floor(x / segmentWidth));
    const weight = (x % segmentWidth) / segmentWidth; // renamed: was 'skinWeight', shadowed the array

    skinIndex.push(boneIndex, boneIndex + 1, 0, 0); // fixed: was skinIndex + 1 (array ref, not a number)
    skinWeights.push(1 - weight, weight, 0, 0);     // fixed: shadowed var + was missing 4th value
}

pageGeometry.setAttribute(
    "skinIndex",  // Three.js requires this exact name for skeleton binding
    new Uint16BufferAttribute(skinIndex, 4)
);
pageGeometry.setAttribute(
    "skinWeight",
    new Float32BufferAttribute(skinWeights, 4)
);

const pageMats = [
    new MeshStandardMaterial({ color: whiteColor }),  // 0: right edge
    new MeshStandardMaterial({ color: '#111' }),       // 1: left edge (spine)
    new MeshStandardMaterial({ color: whiteColor }),  // 2: top edge
    new MeshStandardMaterial({ color: whiteColor }),  // 3: bottom edge
    // index 4 (front face) and index 5 (back face) are added dynamically per-page below
];

pages.forEach((page) => {
    useTexture.preload(`/textures/${page.front}.jpg`);
    useTexture.preload(`/textures/${page.back}.jpg`);
    useTexture.preload(`/textures/book-cover-roughness.jpg`);
})

// https://threejs.org/docs/#SkinnedMesh
// Using skinned mesh because it acts as a skeleton, allowing natural animation looking bends in the book.
const Page = ({ number, front, back, ...props }) => {
    const [picture, picture2, pictureRoughness] = useTexture([
        `/textures/${front}.jpg`,
        `/textures/${back}.jpg`,
        ...(number === 0 || number === pages.length - 1
            ? [`/textures/book-cover-roughness.jpg`]
            : [])
    ]);
    picture.colorSpace = picture2.colorSpace = SRGBColorSpace;
    const group = useRef();
    const skinnedMeshRef = useRef();

    const SkinnedMeshMemo = useMemo(() => {
        const bones = [];
        for (let i = 0; i <= pageSegments; i++) {
            let bone = new Bone(); // fixed: Bone was not imported
            bone.position.x = 0;
            if (i === 0) {
                bone.position.x = 0;
            } else {
                bone.position.x = segmentWidth;
            }
            if (i > 0) {
                bones[i - 1].add(bone);
            }
            bones.push(bone); // fixed: bones were created but never added to the array
        }
        const skeleton = new Skeleton(bones);

        const mats = [...pageMats,
        new MeshStandardMaterial({
            color: whiteColor,
            map: picture,
            ...(number === 0
                ? {
                    roughnessMap: pictureRoughness,
                }
                : {
                    roughness: 0.1,
                }
            )
        }),
        new MeshStandardMaterial({
            color: whiteColor,
            map: picture2,
            ...(number === pages.length - 1
                ? {
                    roughnessMap: pictureRoughness,
                }
                : {
                    roughness: 0.1,
                }
            )
        })
        ];
        const mesh = new SkinnedMesh(pageGeometry, mats);
        mesh.castShadow = true;
        mesh.receiveShadow = true; // fixed: typo was 'recieveShadow'
        mesh.frustumCulled = false;
        mesh.add(skeleton.bones[0]);
        mesh.bind(skeleton);
        return mesh;
    }, [picture, picture2, pictureRoughness]); // textures are async — memo must re-run once they load

    return (
        <group {...props} ref={group}>
            <primitive object={SkinnedMeshMemo} ref={skinnedMeshRef} /> {/* fixed: typo was 'primative' */}
        </group>
    );
};

export const Book = ({ ...props }) => {
    return (
        <group {...props}>
            {[...pages].map((pageData, index) => (
                index === 0 ?
                    <Page key={index} number={index} {...pageData}
                    /> : null
            ))}
        </group>
    );
};