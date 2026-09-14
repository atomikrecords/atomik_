import SwiftUI

/// Shown while the captured images are turned into a USDZ model on device.
struct ReconstructionView: View {
    let progress: Double

    var body: some View {
        VStack(spacing: 28) {
            Spacer()

            ZStack {
                Circle()
                    .stroke(Color.white.opacity(0.15), lineWidth: 6)
                Circle()
                    .trim(from: 0, to: max(0.01, progress))
                    .stroke(Color.accentColor, style: StrokeStyle(lineWidth: 6, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .animation(.easeInOut, value: progress)
                Text("\(Int(progress * 100))%")
                    .font(.title2.weight(.semibold).monospacedDigit())
            }
            .frame(width: 140, height: 140)

            VStack(spacing: 6) {
                Text("Building your model")
                    .font(.headline)
                Text("Keep the app open — this runs entirely on device.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 40)
            }

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.black)
    }
}
