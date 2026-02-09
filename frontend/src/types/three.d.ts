/* eslint-disable @typescript-eslint/no-explicit-any */
import * as THREE from 'three';

/**
 * React Three Fiber JSX type declarations
 * Required for TypeScript to recognize R3F elements like <mesh>, <boxGeometry>, etc.
 */
declare global {
    namespace JSX {
        interface IntrinsicElements {
            // Core objects
            mesh: any;
            group: any;
            primitive: any;

            // Geometries
            boxGeometry: any;
            sphereGeometry: any;
            planeGeometry: any;
            coneGeometry: any;
            cylinderGeometry: any;
            torusGeometry: any;
            bufferGeometry: any;

            // Materials
            meshBasicMaterial: any;
            meshStandardMaterial: any;
            meshPhongMaterial: any;
            meshLambertMaterial: any;
            meshNormalMaterial: any;
            meshPhysicalMaterial: any;
            lineBasicMaterial: any;
            lineDashedMaterial: any;
            pointsMaterial: any;
            shaderMaterial: any;

            // Lights
            ambientLight: any;
            directionalLight: any;
            pointLight: any;
            spotLight: any;
            hemisphereLight: any;
            rectAreaLight: any;

            // Cameras
            perspectiveCamera: any;
            orthographicCamera: any;

            // Helpers
            axesHelper: any;
            gridHelper: any;
            boxHelper: any;
            cameraHelper: any;

            // Lines
            line: any;
            lineLoop: any;
            lineSegments: any;
            points: any;

            // Other
            fog: any;
            color: any;
            instancedMesh: any;
            sprite: any;
            spriteMaterial: any;
            lOD: any;
            bone: any;
            skeleton: any;
            skinnedMesh: any;

            // Buffer attributes
            bufferAttribute: any;
            instancedBufferAttribute: any;
            instancedBufferGeometry: any;
        }
    }
}

export { THREE };
