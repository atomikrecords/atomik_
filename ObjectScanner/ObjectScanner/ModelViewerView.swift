import SwiftUI
import SceneKit

/// Finished model in a plain 3D environment: drag to orbit, pinch to zoom,
/// two fingers to pan. SceneKit's built-in camera controller handles the
/// gestures, so the scene stays a single lit turntable.
struct ModelViewerView: View {
    let modelURL: URL
    var onNewScan: () -> Void

    var body: some View {
        ZStack {
            ModelSceneView(modelURL: modelURL)
                .ignoresSafeArea()

            VStack {
                HStack {
                    Spacer()
                    ShareLink(item: modelURL) {
                        Image(systemName: "square.and.arrow.up")
                            .font(.system(size: 15, weight: .semibold))
                            .padding(10)
                    }
                    .buttonStyle(.plain)
                    .background(.ultraThinMaterial, in: Circle())
                }
                .padding(.horizontal, 20)
                .padding(.top, 8)

                Spacer()

                Button(action: onNewScan) {
                    Text("New Scan")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                }
                .buttonStyle(.borderedProminent)
                .buttonBorderShape(.capsule)
                .padding(.horizontal, 32)
                .padding(.bottom, 32)
            }
            .foregroundStyle(.white)
        }
    }
}

private struct ModelSceneView: UIViewRepresentable {
    let modelURL: URL

    func makeUIView(context: Context) -> SCNView {
        let view = SCNView()
        view.scene = makeScene()
        view.allowsCameraControl = true
        view.defaultCameraController.interactionMode = .orbitTurntable
        view.defaultCameraController.inertiaEnabled = true
        view.autoenablesDefaultLighting = true
        view.antialiasingMode = .multisampling4X
        view.backgroundColor = .black
        return view
    }

    func updateUIView(_ view: SCNView, context: Context) {}

    private func makeScene() -> SCNScene {
        guard let scene = try? SCNScene(url: modelURL) else { return SCNScene() }

        // Frame the model and give it a soft studio light so it reads well.
        let camera = SCNCamera()
        camera.zNear = 0.001
        camera.zFar = 100
        let cameraNode = SCNNode()
        cameraNode.camera = camera
        scene.rootNode.addChildNode(cameraNode)

        let (minBound, maxBound) = scene.rootNode.boundingBox
        let center = SCNVector3((minBound.x + maxBound.x) / 2,
                                (minBound.y + maxBound.y) / 2,
                                (minBound.z + maxBound.z) / 2)
        let extent = max(maxBound.x - minBound.x,
                         max(maxBound.y - minBound.y, maxBound.z - minBound.z))
        let distance = max(extent * 2.2, 0.05)
        cameraNode.position = SCNVector3(center.x, center.y, center.z + distance)
        cameraNode.look(at: center)

        let ambient = SCNNode()
        ambient.light = SCNLight()
        ambient.light?.type = .ambient
        ambient.light?.intensity = 300
        scene.rootNode.addChildNode(ambient)

        return scene
    }
}
