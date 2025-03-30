import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { CustomOutlinePass } from '../../js/CustomOutlinePass.js';
import FindSurfaces from '../../js/FindSurfaces.js';

class RobotVisualizer {
    constructor(containerId, modelPath) {
        this.container = document.getElementById(containerId);
        this.modelPath = modelPath;
        this.lastTime = 0;
        this.rotationSpeed = 0.055;
        this.isModelLoaded = false;
        this.setup();
    }

    setup() {
        this.scene = new THREE.Scene();
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: window.innerWidth > 768,
            powerPreference: "high-performance",
            alpha: true
        });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setClearColor(0x000000, 0);
        this.container.appendChild(this.renderer.domElement);

        this.camera = new THREE.PerspectiveCamera(40, this.container.clientWidth / this.container.clientHeight, 0.01, 1000);
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableZoom = false;

        this.setupLights();
        this.setupPostProcessing();
        this.loadModel();

        this.renderer.setPixelRatio(window.devicePixelRatio);

        window.addEventListener('resize', () => this.onWindowResize(), false);
    }

    handleLoadComplete() {
        const loadingOverlay = document.querySelector('.loading-overlay');
        loadingOverlay.classList.add('fade-out');
        
        setTimeout(() => {
            this.container.classList.add('visible');
            setTimeout(() => {
                loadingOverlay.remove();
            }, 500);
        }, 500);

        this.isModelLoaded = true;
    }

    setupLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
        directionalLight.position.set(0, 1, 0);
        this.scene.add(directionalLight);
    }

    setupPostProcessing() {
        this.composer = new EffectComposer(this.renderer);
        if(window.innerWidth < 768) {
            this.composer.setPixelRatio(window.devicePixelRatio*0.8);
        } else {
            this.composer.setPixelRatio(window.devicePixelRatio);
        }
        const renderPass = new RenderPass(this.scene, this.camera);
        renderPass.clearAlpha = 0;
        this.composer.addPass(renderPass);

        this.outlinePass = new CustomOutlinePass(
            new THREE.Vector2(this.container.clientWidth, this.container.clientHeight), 
            this.scene, 
            this.camera
        );
        //this.composer.addPass(this.outlinePass);
    }

    loadModel() {
        /* Draco loader for better performance */
        const dracoLoader = new DRACOLoader();  
        dracoLoader.setDecoderPath('../../js/draco/');  

        const loader = new GLTFLoader();
        loader.setDRACOLoader(dracoLoader);

        loader.load(
            this.modelPath,
            (gltf) => {
                this.model = gltf.scene;
                this.applyMaterial();
                this.scene.add(this.model);
                this.addSurfaceIdAttributeToMesh();
                this.centerModel();
                this.setCameraSettings();
                this.outlinePass.selectedObjects = [this.model];
                this.handleLoadComplete();
                this.animate(0);
            },
            (progress) => {
                const percent = Math.min(
                    (progress.loaded / progress.total * 100).toFixed(0),
                                100);
                const loadingText = document.querySelector('.loading-text');
                if (loadingText) {
                    loadingText.textContent = `Loading ${percent}%`;
                }
            },
            (error) => {
                console.error('An error occurred while loading the GLTF model:', error);
            }
        );
    }

    applyMaterial() {
        const modelMaterial = new THREE.ShaderMaterial({
            uniforms: {
                baseColor: { value: new THREE.Color(0xb0b0b0) },
                normalScale: { value: 0.9 }
            },
            vertexShader: `
                varying vec3 vNormal;
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 baseColor;
                uniform float normalScale;
                varying vec3 vNormal;
                void main() {
                    float normalValue = (dot(vNormal, vec3(0, 0, 1)) * 0.5 + 0.5) * normalScale;
                    gl_FragColor = vec4(baseColor, 1.0) * (0.5 + normalValue);
                }
            `,
            precision: window.innerWidth <= 768 ? 'mediump' : 'highp'
        });

        this.model.traverse((child) => {
            if (child.isMesh) {
                //child.material = modelMaterial; // uncomment for "blueprint" effect 
            }
        });
    }

    addSurfaceIdAttributeToMesh() {
        const surfaceFinder = new FindSurfaces();
        surfaceFinder.surfaceId = 0;

        this.model.traverse((node) => {
            if (node.type == "Mesh") {
                const colorsTypedArray = surfaceFinder.getSurfaceIdAttribute(node);
                node.geometry.setAttribute(
                    "color",
                    new THREE.BufferAttribute(colorsTypedArray, 4)
                );
            }
        });

        this.outlinePass.updateMaxSurfaceId(surfaceFinder.surfaceId + 1);
    }

    centerModel() {
        this.modelGroup = new THREE.Group();
        this.scene.add(this.modelGroup);

        const box = new THREE.Box3().setFromObject(this.model);
        const center = box.getCenter(new THREE.Vector3());

        this.model.position.sub(center);
        this.modelGroup.add(this.model);
        this.modelGroup.position.y = -0.03;
        this.modelGroup.rotation.x = -Math.PI / 2;
        this.modelGroup.rotation.z = -Math.PI / 0.55;
        this.modelGroup.position.x = 0.005;
        this.camera.position.set(0.03, 0.14, 0.37);
    }

setCameraSettings() {
        if (window.innerWidth <= 768) {
            this.controls.enableRotate = false;
           this.camera.position.set(0.03, 0.14, 0.37);  // Adjusted Z position for mobile
            this.camera.rotation.set(-0.46, 0.08, 0.04);
            this.modelGroup.scale.set(0.66, 0.66, 0.66);  // Scale down model on mobile
            this.modelGroup.position.y = 0.01;
        } else {
            this.controls.enableRotate = true;
            this.camera.position.set(0.03, 0.14, 0.37);
            this.camera.rotation.set(-0.46, 0.08, 0.04);
            this.modelGroup.scale.set(1, 1, 1);  // Reset scale for desktop
        }
        this.controls.target.set(0, 0, 0);
        this.controls.update();
    }

    animate(currentTime) {
        requestAnimationFrame((t) => this.animate(t));

        // Convert time to seconds
        currentTime *= 0.001;

        // Calculate delta time
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;

        if (this.modelGroup) {
            // Calculate rotation based on fixed rotation speed
            // const rotationAngle = this.rotationSpeed * Math.PI * 2 * deltaTime;
            // this.modelGroup.rotation.z += rotationAngle;
        }

        this.controls.update();
        this.composer.render();
    }

    onWindowResize() {
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.composer.setSize(this.container.clientWidth, this.container.clientHeight);
        
        this.outlinePass.setSize(this.container.clientWidth, this.container.clientHeight);
        //this.setCameraSettings(); // uncomment to update camera everytime window changes (will break stuff)
        //this.setOutlineParameters(); // Update outline parameters on resize
    }
}

// Initialize single robot instance
const lunchpadVisualizer = new RobotVisualizer('visualizer', '../../gltfs/noogie-opt.glb'); 