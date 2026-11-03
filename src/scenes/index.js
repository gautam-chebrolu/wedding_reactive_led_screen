import { MoonScene, moonMetadata } from './moon.js';
import { PortraitScene, portraitMetadata } from './portrait.js';
import { CameraScene, cameraMetadata } from './camera-remix.js';
import { BallScene, ballMetadata } from './ball.js';
import { KaleidoscopeScene, kaleidoscopeMetadata } from './kaleidoscope.js';
import { MonogramScene, monogramMetadata } from './monogram.js';
import { DVDScene, dvdMetadata } from './dvd.js';

// Add a scene here. It receives the exact same audio, camera and settings frame.
export const sceneRegistry = [
  { ...moonMetadata, create: () => new MoonScene() },
  { ...portraitMetadata, create: () => new PortraitScene() },
  { ...cameraMetadata, create: () => new CameraScene() },
  { ...ballMetadata, create: () => new BallScene() },
  { ...kaleidoscopeMetadata, create: () => new KaleidoscopeScene() },
  { ...monogramMetadata, create: () => new MonogramScene() },
  { ...dvdMetadata, create: () => new DVDScene() }
];
