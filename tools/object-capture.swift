import Foundation
import RealityKit

@main
struct EvidenceObjectCapture {
    static func main() async {
        do {
            let arguments = Array(CommandLine.arguments.dropFirst())
            if arguments == ["--check"] {
                try requireSupportedHardware()
                print("RealityKit Object Capture is available.")
                return
            }
            guard arguments.count == 2 else {
                throw CaptureError("Usage: object-capture <photos-directory> <output.usdz> | --check")
            }

            let input = URL(fileURLWithPath: arguments[0], isDirectory: true)
            let output = URL(fileURLWithPath: arguments[1])
            let files = FileManager.default
            var isDirectory: ObjCBool = false
            guard files.fileExists(atPath: input.path, isDirectory: &isDirectory),
                  isDirectory.boolValue else {
                throw CaptureError("Photo input must be an existing directory.")
            }
            guard output.pathExtension.lowercased() == "usdz",
                  !files.fileExists(atPath: output.path) else {
                throw CaptureError("Choose a new output path ending in .usdz.")
            }
            try requireSupportedHardware()

            let session = try PhotogrammetrySession(input: input, configuration: .init())
            let request = PhotogrammetrySession.Request.modelFile(url: output, detail: .reduced)
            try session.process(requests: [request])

            var modelURL: URL?
            for try await update in session.outputs {
                switch update {
                case .requestProgress(_, let fraction):
                    print("Reconstructing: \(Int(fraction * 100))%")
                case .requestComplete(_, let result):
                    if case .modelFile(let url) = result {
                        modelURL = url
                    }
                case .requestError(_, let error):
                    throw error
                case .processingCancelled:
                    throw CaptureError("Reconstruction was cancelled.")
                case .processingComplete:
                    guard let modelURL, files.fileExists(atPath: modelURL.path) else {
                        throw CaptureError("Reconstruction finished without producing a model.")
                    }
                    print(modelURL.path)
                    return
                default:
                    break
                }
            }
            throw CaptureError("The session ended before reconstruction completed.")
        } catch {
            FileHandle.standardError.write(Data("\(error.localizedDescription)\n".utf8))
            exit(1)
        }
    }

    private static func requireSupportedHardware() throws {
        guard PhotogrammetrySession.isSupported else {
            throw CaptureError("RealityKit Object Capture is unavailable on this Mac.")
        }
    }
}

private struct CaptureError: LocalizedError {
    let errorDescription: String?

    init(_ message: String) {
        errorDescription = message
    }
}
