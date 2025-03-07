// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
	75,
	window.innerWidth / window.innerHeight,
	0.1,
	100
);

// Enhanced renderer settings
const renderer = new THREE.WebGLRenderer({
	antialias: true,
	alpha: true,
	powerPreference: "high-performance",
	logarithmicDepthBuffer: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.setClearColor(0x000000, 0);
document.body.appendChild(renderer.domElement);

// Add HDR environment map
const rgbeLoader = new THREE.RGBELoader();
rgbeLoader.load(
	"hdri/kloofendal_48d_partly_cloudy_puresky_4k.hdr",
	function (texture) {
		texture.mapping = THREE.EquirectangularReflectionMapping;
		scene.environment = texture; // Sets the environment map for all physical materials
		scene.background = texture; // Use HDR as background

		// Adjust exposure for the bright outdoor HDR
		renderer.toneMappingExposure = 0.8; // Reduced exposure for bright outdoor HDR
	}
);

// Enhanced lighting setup
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(5, 5, 5);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 50;
directionalLight.shadow.bias = -0.0001;
scene.add(directionalLight);

// Add a second directional light for better illumination
const secondaryLight = new THREE.DirectionalLight(0xffffff, 0.8);
secondaryLight.position.set(-5, 3, -5);
scene.add(secondaryLight);

// Add a subtle hemisphere light for ambient occlusion
const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
scene.add(hemisphereLight);

// Add texture loader with enhanced settings
const textureLoader = new THREE.TextureLoader();
textureLoader.crossOrigin = "anonymous";

// Load your textures with enhanced settings
const diffuseTexture = textureLoader.load("images/GSG_SI_Scratches_04.jpg");
diffuseTexture.encoding = THREE.sRGBEncoding;
diffuseTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

const aoTexture = textureLoader.load("images/GSG_SI_Scratches_04.jpg");
aoTexture.encoding = THREE.sRGBEncoding;
aoTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

// GLTF Loader setup
const loader = new THREE.GLTFLoader();
let mixer;
let model;
let animationAction;
let targetFrame = null;
let isPlaying = false;
let frameInfoElement;
let lastFrameTime = 0;
let stuckCounter = 0;
let lastFrameChecked = -1;

// Define component timeline data
const componentTimelineData = [
	{
		frame: 51,
		name: "Tank Barrel Cylinder Section",
		description:
			"Main cargo containment vessel built to pressure specifications. Core component designed for product integrity and safety.",
	},
	{
		frame: 71,
		name: "Tank Barrel Dome Ends",
		description:
			"Engineered end caps completing the pressure vessel. Curved design maximizes strength under load.",
	},
	{
		frame: 114,
		name: "Tank Barrel Vacuum Stiffening Rings",
		description:
			"Reinforcements preventing collapse during discharge. Critical safety feature for vacuum operations.",
	},
	{
		frame: 141,
		name: "Steam Tube Heating System",
		description:
			"External thermal control for temperature-sensitive cargoes. Maintains product in optimal flowing state.",
	},
	{
		frame: 180,
		name: "Valve & Manlid Mounting Flanges",
		description:
			"Reinforced connection points for operational access. Engineered to maintain seal integrity.",
	},
	{
		frame: 260,
		name: "Tank Barrel Insulation",
		description:
			"Thermal barrier maintaining product temperature. Essential for sensitive or heated cargoes.",
	},
	{
		frame: 325,
		name: "Tank Barrel to Frame Mounting Collars",
		description:
			"Specialized attachments securing tank to framework. Accommodates thermal expansion during transport.",
	},
	{
		frame: 372,
		name: "Valve Compartments & Drain Hose Sets",
		description:
			"Protected valve housing with standardized connections. Ensures safe loading and discharge operations.",
	},
	{
		frame: 440,
		name: "External Cladding & Strap Set",
		description:
			"Protective outer shell with secure mounting. Shields insulation and improves durability.",
	},
	{
		frame: 500,
		name: "Tank Support Frame & Corner Castings",
		description:
			"Standardized framework for intermodal handling. Enables secure transport across shipping modes.",
	},
	{
		frame: 540,
		name: "Top Access Walkway Set",
		description:
			"Safety-compliant platform for maintenance access. Provides secure footing during operations.",
	},
	{
		frame: 660,
		name: "Valves, Man Lid & Monitoring Components",
		description:
			"Certified fixtures for product handling and inspection. Meets international safety standards.",
	},
];

// Create a loading overlay with progress bar
const loadingOverlay = document.createElement("div");
loadingOverlay.style.position = "fixed";
loadingOverlay.style.top = "0";
loadingOverlay.style.left = "0";
loadingOverlay.style.width = "100%";
loadingOverlay.style.height = "100%";
loadingOverlay.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
loadingOverlay.style.display = "flex";
loadingOverlay.style.flexDirection = "column";
loadingOverlay.style.alignItems = "center";
loadingOverlay.style.justifyContent = "center";
loadingOverlay.style.zIndex = "1000";

const progressContainer = document.createElement("div");
progressContainer.style.width = "50%";
progressContainer.style.maxWidth = "500px";
progressContainer.style.backgroundColor = "#222";
progressContainer.style.borderRadius = "10px";
progressContainer.style.overflow = "hidden";
progressContainer.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.5)";

const progressBar = document.createElement("div");
progressBar.style.height = "30px";
progressBar.style.width = "0%";
progressBar.style.backgroundColor = "#4CAF50";
progressBar.style.transition = "width 0.2s";

const progressText = document.createElement("div");
progressText.textContent = "Loading 3D Models: 0%";
progressText.style.color = "white";
progressText.style.padding = "20px";
progressText.style.fontFamily = "Arial, sans-serif";
progressText.style.fontSize = "18px";

progressContainer.appendChild(progressBar);
loadingOverlay.appendChild(progressText);
loadingOverlay.appendChild(progressContainer);
document.body.appendChild(loadingOverlay);

// Track loading progress
let totalModelsToLoad = 4; // Main model + 3 additional objects
let loadedModels = 0;
let currentProgress = {};

// Function to update progress
function updateProgress(modelId, percent) {
	currentProgress[modelId] = percent;

	// Calculate overall progress
	let totalPercent = 0;
	for (const key in currentProgress) {
		totalPercent += currentProgress[key];
	}

	// Average the progress across all models
	const averagePercent = totalPercent / totalModelsToLoad;

	// Update the progress bar
	progressBar.style.width = `${averagePercent}%`;
	progressText.textContent = `Loading 3D Models: ${Math.round(
		averagePercent
	)}%`;

	// If everything is loaded, hide the overlay
	if (averagePercent >= 100) {
		setTimeout(() => {
			loadingOverlay.style.opacity = "0";
			loadingOverlay.style.transition = "opacity 0.5s";
			setTimeout(() => {
				loadingOverlay.style.display = "none";
			}, 500);
		}, 500); // Short delay to show 100% complete
	}
}

// Function when a single model is completely loaded
function modelLoaded() {
	loadedModels++;
	if (loadedModels === totalModelsToLoad) {
		updateProgress("complete", 100);
	}
}

// Function to check and apply textures to a node
function applyTexturesToNode(node) {
	if (node.isMesh && node.material) {
		console.log("\nProcessing mesh:", node.name);

		// Check existing textures
		const hasDiffuse = node.material.map !== null;
		const hasAO = node.material.aoMap !== null;
		const hasNormal = node.material.normalMap !== null;
		const hasRoughness = node.material.roughnessMap !== null;
		const hasMetalness = node.material.metalnessMap !== null;

		//list name of the node and material
		// console.log("Node name:", node.name);
		// console.log("Material name:", node.material.name);

		// Common properties
		node.material.side = THREE.DoubleSide;
		node.material.dithering = true;
		node.material.flatShading = false;
		node.material.precision = "highp";

		// Add small polygon offset to reduce z-fighting
		node.material.polygonOffset = true;
		node.material.polygonOffsetFactor = 1;
		node.material.polygonOffsetUnits = 1;

		// Ensure proper depth testing
		node.material.depthTest = true;
		node.material.depthWrite = true;

		// Add a tiny random offset to each mesh position to prevent exact overlap
		const tiny_offset = 0.0001;
		node.position.x += (Math.random() - 0.5) * tiny_offset;
		node.position.y += (Math.random() - 0.5) * tiny_offset;
		node.position.z += (Math.random() - 0.5) * tiny_offset;

		// Enable shadows with enhanced settings
		node.castShadow = true;
		node.receiveShadow = true;
	}
}

// Setup animation when model is loaded
function setupAnimation(gltf) {
	console.log("Setting up animation");

	if (gltf.animations.length > 0) {
		console.log(`Found ${gltf.animations.length} animations`);
		mixer = new THREE.AnimationMixer(model);

		// List all available animations
		console.log("\nAvailable animations:");
		gltf.animations.forEach((clip, index) => {
			console.log(
				`${index}: ${clip.name} (${clip.duration}s, ${clip.tracks[0].times.length} frames)`
			);
		});

		// Create the animation action but don't play it yet
		animationAction = mixer.clipAction(gltf.animations[0]);

		// Configure animation
		animationAction.setLoop(THREE.LoopOnce, 1); // Change to LoopOnce for better frame control
		animationAction.clampWhenFinished = true; // Clamp at the end
		animationAction.timeScale = 2;

		// Initialize but don't play
		animationAction.setEffectiveTimeScale(1);
		animationAction.setEffectiveWeight(1);
		animationAction.reset();
		animationAction.paused = true;

		// Need to call play() to initialize the animation, even though it's paused
		animationAction.play();

		console.log("Animation initialized and paused");

		// Initialize the animation at frame 1
		setFrame(1);
	} else {
		console.warn("No animations found in the model");
	}
}

// Function to set a specific frame
function setFrame(frameNumber) {
	if (!mixer || !animationAction) {
		console.error("Cannot set frame - mixer or action not initialized");
		return;
	}

	const totalFrames = 770; // Set total frames to 770
	const totalDuration = animationAction.getClip().duration;

	// Clamp frame number to valid range
	frameNumber = Math.max(0, Math.min(frameNumber, totalFrames));

	// Calculate time for the frame
	const frameTime = (frameNumber / totalFrames) * totalDuration;

	console.log(
		`Setting to frame ${frameNumber}, time: ${frameTime.toFixed(
			3
		)}/${totalDuration.toFixed(3)}`
	);

	// Set the animation time
	animationAction.time = frameTime;
	mixer.update(0); // Update mixer to apply the new time

	// Update frame info display
	updateFrameInfo(frameNumber);
}

// Function to animate to a target frame
function animateToFrame(targetFrameNumber) {
	console.log("Animating to frame:", targetFrameNumber);

	if (!mixer || !animationAction) {
		console.error("Mixer or animation action not initialized");
		return;
	}

	// Reset stuck detection
	stuckCounter = 0;
	lastFrameChecked = -1;

	const totalFrames = 770; // Set the total frames to 770
	const currentFrame = getCurrentFrame();

	// If we're already at the target frame, no need to animate
	if (currentFrame === targetFrameNumber) {
		console.log("Already at target frame, no animation needed");
		updateFrameInfo(currentFrame);
		return;
	}

	// Clamp target frame to valid range
	targetFrameNumber = Math.max(0, Math.min(targetFrameNumber, totalFrames));

	console.log(
		"Current frame:",
		currentFrame,
		"Target frame:",
		targetFrameNumber
	);

	// Reset the animation if it was previously playing
	if (isPlaying) {
		animationAction.stop();
		animationAction.reset();
	}

	// Determine direction (forward or reverse)
	const direction = targetFrameNumber > currentFrame ? 1 : -1;

	// For reverse direction, we need to ensure the animation is properly initialized
	if (direction < 0) {
		// For reverse animation, start from the current time and go backward
		animationAction.time =
			animationAction.getClip().duration * (currentFrame / totalFrames);
		animationAction.timeScale = -1; // Negative for reverse, twice normal speed
		animationAction.zeroSlopeAtEnd = false; // Ensure smooth animation at end
		animationAction.zeroSlopeAtStart = false; // Ensure smooth animation at start
		animationAction.paused = false;
	} else {
		// For forward animation, start from the current time and go forward
		animationAction.time =
			animationAction.getClip().duration * (currentFrame / totalFrames);
		animationAction.timeScale = 1; // Forward at twice normal speed
		animationAction.paused = false;
	}

	// Set target and start playing
	targetFrame = targetFrameNumber;
	isPlaying = true;
	lastFrameTime = performance.now();

	// Make sure the animation is enabled and playing
	animationAction.enabled = true;
	animationAction.play();

	console.log(
		"Animation started, direction:",
		direction > 0 ? "forward" : "reverse",
		"timeScale:",
		animationAction.timeScale
	);
}

// Function to get current frame
function getCurrentFrame() {
	if (!mixer || !animationAction) return 0;

	const totalFrames = 770; // Set total frames to 770
	const totalDuration = animationAction.getClip().duration;
	const currentTime = animationAction.time % totalDuration; // Handle looping

	// Calculate frame number
	return Math.round((currentTime / totalDuration) * totalFrames);
}

// Update frame info display
function updateFrameInfo(frameNumber) {
	if (frameInfoElement) {
		frameInfoElement.textContent = `Frame: ${Math.round(frameNumber)}`;
	}

	// Update the timeline cursor position
	updateTimelineCursor(frameNumber);

	// Update active component state
	updateActiveComponentState(frameNumber);
}

// New function to update the timeline cursor position
function updateTimelineCursor(frameNumber) {
	const timelineCursor = document.getElementById("timelineCursor");
	if (!timelineCursor) return;

	const totalFrames = 770;
	const positionPercent = (frameNumber / totalFrames) * 100;

	// Set the position of the cursor
	timelineCursor.style.left = `${positionPercent}%`;
}

// New function to update which component is active based on the current frame
function updateActiveComponentState(currentFrame) {
	const components = document.querySelectorAll(".timeline-component");

	// Reset all active states
	components.forEach((component) => {
		component.classList.remove("active");
	});

	// Find the active component
	let activeComponent = null;
	let nextComponentIndex = componentTimelineData.length;

	for (let i = 0; i < componentTimelineData.length; i++) {
		if (currentFrame >= componentTimelineData[i].frame) {
			activeComponent = componentTimelineData[i];
		} else {
			nextComponentIndex = i;
			break;
		}
	}

	// If we found an active component, highlight it
	if (activeComponent) {
		const activeElement = document.querySelector(
			`.timeline-component[data-frame="${activeComponent.frame}"]`
		);
		if (activeElement) {
			activeElement.classList.add("active");

			// Scroll to the active component if it's not visible
			ensureElementIsVisible(activeElement);
		}
	}
}

// Function to ensure active element is visible in the scrollable container
function ensureElementIsVisible(element) {
	const container = document.getElementById("timelineContainer");
	if (!container) return;

	const containerRect = container.getBoundingClientRect();
	const elementRect = element.getBoundingClientRect();

	// If element is not fully visible, scroll to it
	if (
		elementRect.top < containerRect.top ||
		elementRect.bottom > containerRect.bottom
	) {
		const scrollTop =
			element.offsetTop -
			container.offsetTop -
			container.clientHeight / 2 +
			element.clientHeight / 2;
		container.scrollTo({
			top: scrollTop,
			behavior: "smooth",
		});
	}
}

// Load the GLTF model
loader.load(
	// "models/ISO TANK Animated_03-06-25/Full_model_05.glb",
	"https://dl.dropboxusercontent.com/scl/fi/vumf84gvc8xlkhurrxyb2/Full_model_05.glb?rlkey=he5nm5e1tf7xjfvuk6m2q5n64&dl=1",
	function (gltf) {
		console.log("Model loaded successfully");
		model = gltf.scene;
		scene.add(model);

		// Process all nodes and their children
		model.traverse((node) => {
			applyTexturesToNode(node);

			// If the node has children, process them too
			if (node.children) {
				node.children.forEach((child) => {
					applyTexturesToNode(child);
				});
			}
		});

		// Setup animation but don't autoplay
		setupAnimation(gltf);

		// Optional: Adjust model position/scale if needed
		model.scale.set(1, 1, 1);
		model.position.set(0, 0, 0);

		console.log("Model setup complete");
		modelLoaded();
	},
	// Progress callback
	function (xhr) {
		const percent = (xhr.loaded / xhr.total) * 100;
		console.log(percent + "% loaded");
		updateProgress("mainModel", percent);
	},
	function (error) {
		console.error("An error occurred loading the model:", error);
		updateProgress("mainModel", 100); // Mark as complete even on error
		modelLoaded();
	}
);

// Add OBJ loaders for the three models
const objLoader = new THREE.OBJLoader();
let ringObject = null;
let frameObject = null;
let boxFrameObject = null;

// Load the ring_final.obj
objLoader.load(
	"models/ISO TANK Animated_03-06-25/obj/ring_final.obj",
	function (object) {
		ringObject = object;
		// Apply the same material settings as GLTF model
		object.traverse((node) => {
			if (node.isMesh) {
				applyTexturesToNode(node);
				// Set initial scale and opacity
				node.scale.set(1.5, 1.5, 1.5);
				if (node.material) {
					node.material.transparent = true;
					node.material.opacity = 0;
				}
			}
		});
		scene.add(object);
		modelLoaded();
	},
	function (xhr) {
		const percent = (xhr.loaded / xhr.total) * 100;
		console.log("Ring model: " + percent + "% loaded");
		updateProgress("ringModel", percent);
	},
	function (error) {
		console.error("An error occurred loading the ring model:", error);
		updateProgress("ringModel", 100); // Mark as complete even on error
		modelLoaded();
	}
);

// Load the frame_final.obj
objLoader.load(
	"models/ISO TANK Animated_03-06-25/obj/frame_final.obj",
	function (object) {
		frameObject = object;
		// Apply the same material settings as GLTF model
		object.traverse((node) => {
			if (node.isMesh) {
				applyTexturesToNode(node);
				// Set initial scale and opacity
				node.scale.set(1.5, 1.5, 1.5);
				if (node.material) {
					node.material.transparent = true;
					node.material.opacity = 0;
				}
			}
		});
		scene.add(object);
		modelLoaded();
	},
	function (xhr) {
		const percent = (xhr.loaded / xhr.total) * 100;
		console.log("Frame model: " + percent + "% loaded");
		updateProgress("frameModel", percent);
	},
	function (error) {
		console.error("An error occurred loading the frame model:", error);
		updateProgress("frameModel", 100); // Mark as complete even on error
		modelLoaded();
	}
);

// Load the box_frame_final.obj
objLoader.load(
	"models/ISO TANK Animated_03-06-25/obj/box_frame_final.obj",
	function (object) {
		boxFrameObject = object;
		// Apply the same material settings as GLTF model
		object.traverse((node) => {
			if (node.isMesh) {
				applyTexturesToNode(node);
				// Set initial scale and opacity
				node.scale.set(1.5, 1.5, 1.5);
				if (node.material) {
					node.material.transparent = true;
					node.material.opacity = 0;
					// Apply blue color
					node.material.color = new THREE.Color(0x0066ff); // Blue color
				}
			}
		});
		scene.add(object);
		modelLoaded();
	},
	function (xhr) {
		const percent = (xhr.loaded / xhr.total) * 100;
		console.log("Box frame model: " + percent + "% loaded");
		updateProgress("boxFrameModel", percent);
	},
	function (error) {
		console.error("An error occurred loading the box frame model:", error);
		updateProgress("boxFrameModel", 100); // Mark as complete even on error
		modelLoaded();
	}
);

// Create floor with enhanced material
const floorGeometry = new THREE.PlaneGeometry(20, 20);
const floorMaterial = new THREE.MeshStandardMaterial({
	color: 0x2c3e50, // Deep blue-gray color
	roughness: 0.7, // Slightly smoother surface
	metalness: 0.3, // Slightly more metallic
	envMapIntensity: 1.2,
	side: THREE.DoubleSide,
});

// Add subtle grid pattern to floor
const gridTexture = textureLoader.load(
	"https://threejs.org/examples/textures/grid.png"
);
gridTexture.wrapS = THREE.RepeatWrapping;
gridTexture.wrapT = THREE.RepeatWrapping;
gridTexture.repeat.set(10, 10);
gridTexture.encoding = THREE.sRGBEncoding;
floorMaterial.map = gridTexture;

const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.position.y = -1;
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// Setup OrbitControls with enhanced settings
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxPolarAngle = Math.PI / 2;
controls.minDistance = 2;
controls.maxDistance = 10;
controls.target.set(0, 1, 0);

// Position camera
camera.position.set(0, 2, 5);

// Animation loop
function animate() {
	requestAnimationFrame(animate);

	// Calculate delta time for smoother animation
	const now = performance.now();
	const delta = Math.min((now - lastFrameTime) / 1000, 0.1); // Cap at 100ms to prevent large jumps
	lastFrameTime = now;

	// Update controls
	controls.update();

	// Update animation mixer
	if (mixer) {
		// Always update the mixer to ensure frame changes are applied
		mixer.update(delta);

		// Get current frame and update frame info
		const currentFrame = getCurrentFrame();
		updateFrameInfo(currentFrame);

		// Check if we've reached the target frame when playing
		if (targetFrame !== null) {
			// Detect if animation is stuck (same frame being checked repeatedly)
			if (currentFrame === lastFrameChecked) {
				stuckCounter++;
				if (stuckCounter > 30) {
					console.warn("Animation appears stuck, forcing frame jump");
					setFrame(targetFrame);
					targetFrame = null;
					stuckCounter = 0;
				}
			} else {
				stuckCounter = 0;
				lastFrameChecked = currentFrame;
			}

			// Check if we've reached the target frame (with small tolerance)
			const tolerance = 0.5;
			if (Math.abs(currentFrame - targetFrame) <= tolerance) {
				console.log(`Reached target frame: ${targetFrame}`);

				// Pause the animation once target is reached
				if (animationAction) {
					animationAction.paused = true;
				}

				// Clear the target
				targetFrame = null;
			}
		}

		// Update rings animation
		updateRingsAnimation(currentFrame);
	}

	// Render the scene
	renderer.render(scene, camera);
}

// Update the updateRingsAnimation function to handle all three objects
function updateRingsAnimation(currentFrame) {
	// Animation parameters for ring_final.obj
	const ringScaleStartFrame = 115;
	const ringScaleEndFrame = 140;
	const ringScaleFrameRange = ringScaleEndFrame - ringScaleStartFrame;
	const ringOpacityStartFrame = 115;
	const ringOpacityEndFrame = 122;
	const ringOpacityFrameRange = ringOpacityEndFrame - ringOpacityStartFrame;

	// Animation parameters for frame_final.obj
	const frameScaleStartFrame = 270;
	const frameScaleEndFrame = 312;
	const frameScaleFrameRange = frameScaleEndFrame - frameScaleStartFrame;
	const frameOpacityStartFrame = 270;
	const frameOpacityEndFrame = 290;
	const frameOpacityFrameRange = frameOpacityEndFrame - frameOpacityStartFrame;

	// Animation parameters for box_frame_final.obj
	const boxFrameScaleStartFrame = 460;
	const boxFrameScaleEndFrame = 480;
	const boxFrameScaleFrameRange =
		boxFrameScaleEndFrame - boxFrameScaleStartFrame;
	const boxFrameOpacityStartFrame = 470;
	const boxFrameOpacityEndFrame = 480;
	const boxFrameOpacityFrameRange =
		boxFrameOpacityEndFrame - boxFrameOpacityStartFrame;

	// Common parameters
	const startScale = 1.5;
	const endScale = 1.0;
	const startOpacity = 0;
	const endOpacity = 1;

	// Animate ring_final.obj
	if (ringObject) {
		animateObject(
			ringObject,
			currentFrame,
			ringScaleStartFrame,
			ringScaleEndFrame,
			ringScaleFrameRange,
			ringOpacityStartFrame,
			ringOpacityEndFrame,
			ringOpacityFrameRange,
			startScale,
			endScale,
			startOpacity,
			endOpacity
		);
	}

	// Animate frame_final.obj
	if (frameObject) {
		animateObject(
			frameObject,
			currentFrame,
			frameScaleStartFrame,
			frameScaleEndFrame,
			frameScaleFrameRange,
			frameOpacityStartFrame,
			frameOpacityEndFrame,
			frameOpacityFrameRange,
			startScale,
			endScale,
			startOpacity,
			endOpacity
		);
	}

	// Animate box_frame_final.obj
	if (boxFrameObject) {
		animateObject(
			boxFrameObject,
			currentFrame,
			boxFrameScaleStartFrame,
			boxFrameScaleEndFrame,
			boxFrameScaleFrameRange,
			boxFrameOpacityStartFrame,
			boxFrameOpacityEndFrame,
			boxFrameOpacityFrameRange,
			startScale,
			endScale,
			startOpacity,
			endOpacity
		);
	}
}

// Helper function to animate a single object
function animateObject(
	object,
	currentFrame,
	scaleStartFrame,
	scaleEndFrame,
	scaleFrameRange,
	opacityStartFrame,
	opacityEndFrame,
	opacityFrameRange,
	startScale,
	endScale,
	startOpacity,
	endOpacity
) {
	// Special case for boxFrameObject to ensure it keeps its blue color
	const isBoxFrame = object === boxFrameObject;

	object.traverse((node) => {
		if (node.isMesh) {
			// Handle scale animation
			if (currentFrame >= scaleStartFrame && currentFrame <= scaleEndFrame) {
				// Calculate progress
				const progress = (currentFrame - scaleStartFrame) / scaleFrameRange;
				// Interpolate scale
				const currentScale = startScale + (endScale - startScale) * progress;
				node.scale.setScalar(currentScale);
			} else if (currentFrame < scaleStartFrame) {
				// Keep scale at start value before animation
				node.scale.setScalar(startScale);
			} else if (currentFrame > scaleEndFrame) {
				// Keep scale at end value after animation
				node.scale.setScalar(endScale);
			}

			// Handle opacity animation
			if (node.material) {
				// Enable transparency for the material
				if (!node.material.transparent) {
					node.material.transparent = true;
				}

				// If this is the box frame, ensure it keeps its blue color
				if (isBoxFrame) {
					node.material.color = new THREE.Color(0x0066ff); // Blue color
				}

				let targetOpacity = 0;

				if (
					currentFrame >= opacityStartFrame &&
					currentFrame <= opacityEndFrame
				) {
					// Calculate opacity progress
					const opacityProgress =
						(currentFrame - opacityStartFrame) / opacityFrameRange;
					// Interpolate opacity
					targetOpacity =
						startOpacity + (endOpacity - startOpacity) * opacityProgress;
				} else if (currentFrame < opacityStartFrame) {
					// Keep fully transparent before start frame
					targetOpacity = startOpacity;
				} else if (currentFrame > opacityEndFrame) {
					// Keep fully opaque after end frame
					targetOpacity = endOpacity;
				}

				// Apply the calculated opacity
				node.material.opacity = targetOpacity;

				// Special handling for completely transparent objects
				if (targetOpacity === 0) {
					// Disable shadows
					node.castShadow = false;
					node.receiveShadow = false;

					// These settings help prevent the "masking effect"
					node.visible = false; // Hide the mesh completely

					// If you're still seeing issues, you could also try:
					// node.material.depthWrite = false;
					// node.renderOrder = -1;
				} else {
					// Enable shadows and visibility for non-transparent objects
					node.castShadow = true;
					node.receiveShadow = true;
					node.visible = true;

					// Ensure proper depth writing for non-transparent objects
					node.material.depthWrite = true;

					// For partially transparent objects, you might want to set:
					if (targetOpacity < 1.0) {
						node.material.depthWrite = false; // Better for partial transparency
						node.renderOrder = 1; // Draw after opaque objects
					}
				}
			}
		}
	});
}

// Create component timeline buttons with visual markers
function createComponentTimelineButtons() {
	const timelineContainer = document.getElementById("componentTimeline");
	const timelineTrack = document.getElementById("timelineTrack");

	if (!timelineContainer || !timelineTrack) {
		console.error("Timeline container or track not found");
		return;
	}

	// Clear existing content
	timelineContainer.innerHTML = "";

	// Get the total number of frames for calculating positions
	const totalFrames = 770; // Using the known total frames

	// Create buttons and markers for each component
	componentTimelineData.forEach((component, index) => {
		// Create the component button with improved structure
		const componentButton = document.createElement("div");
		componentButton.className = "timeline-component";
		componentButton.setAttribute("data-frame", component.frame);

		// Calculate the position of this component on the timeline (as percentage)
		const positionPercent = (component.frame / totalFrames) * 100;

		// Create component marker on the timeline
		const marker = document.createElement("div");
		marker.className = "component-marker";
		marker.style.left = `${positionPercent}%`;
		marker.setAttribute(
			"title",
			`${component.name} (Frame ${component.frame})`
		);
		timelineTrack.appendChild(marker);

		// Build the inner HTML for the component button
		componentButton.innerHTML = `
			<div class="frame-number">Frame ${component.frame}</div>
			<div class="component-name">${component.name}</div>
			<div class="component-description">${component.description}</div>
		`;

		// Add the component button to the container
		timelineContainer.appendChild(componentButton);

		// Add click event listener
		componentButton.addEventListener("click", function () {
			console.log(`Animating to frame ${component.frame} - ${component.name}`);
			animateToFrame(component.frame);
		});
	});

	console.log("Component timeline created with visual markers");
}

// Start animation from beginning
function startAnimation() {
	if (!mixer || !animationAction) return;

	console.log("Starting animation from beginning");

	// Reset to frame 1
	setFrame(1);

	// Ensure proper animation state
	animationAction.paused = false;
	animationAction.timeScale = 1;
	isPlaying = true;
}

// Initialize UI controls after the page loads
window.addEventListener("DOMContentLoaded", function () {
	console.log("DOM loaded, setting up controls");

	// Get frame info element
	frameInfoElement = document.getElementById("frameInfo");
	if (!frameInfoElement) {
		console.error("Frame info element not found");
	}

	// Create component timeline buttons
	createComponentTimelineButtons();

	// Initialize timeline cursor position to 0
	updateTimelineCursor(0);

	console.log("Controls setup complete");

	// Start animation automatically after a brief delay to ensure everything is loaded
	setTimeout(() => {
		if (mixer && animationAction) {
			// Start from frame 1
			animateToFrame(1);
		}
	}, 1000);
});

// Handle window resize
window.addEventListener("resize", onWindowResize, false);

function onWindowResize() {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.setPixelRatio(window.devicePixelRatio);
}

// Make sure animation is initialized before the page is fully loaded
document.addEventListener("DOMContentLoaded", function () {
	console.log("DOM content loaded");
});

// Start the animation loop
animate();

animate();
