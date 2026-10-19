import Foundation
import ImageIO
import UniformTypeIdentifiers
// Frames and timings of a macOS dynamic wallpaper (.heic):
//   swiftc -O scripts/heic-frames.swift -o /tmp/heic-frames && /tmp/heic-frames <file.heic> <outdir>
// writes <outdir>/<i>.jpg per frame and prints the apple_desktop:h24 / solar plist (t = fraction of the day).
let args = CommandLine.arguments
let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: args[1]) as CFURL, nil)!
let n = CGImageSourceGetCount(src)
print("frames:", n)
if let md = CGImageSourceCopyMetadataAtIndex(src, 0, nil) {
  CGImageMetadataEnumerateTagsUsingBlock(md, nil, nil) { path, tag in
    let p = path as String
    guard p.hasPrefix("apple_desktop:"), let s = CGImageMetadataTagCopyValue(tag) as? String,
          let d = Data(base64Encoded: s),
          let pl = try? PropertyListSerialization.propertyList(from: d, format: nil) else { return true }
    print(p, pl)
    return true
  }
}
for i in 0..<n {
  let img = CGImageSourceCreateImageAtIndex(src, i, nil)!
  let url = URL(fileURLWithPath: "\(args[2])/\(i).jpg")
  let dst = CGImageDestinationCreateWithURL(url as CFURL, UTType.jpeg.identifier as CFString, 1, nil)!
  CGImageDestinationAddImage(dst, img, [kCGImageDestinationLossyCompressionQuality: 0.9] as CFDictionary)
  CGImageDestinationFinalize(dst)
  if i == 0 { print("size:", img.width, "x", img.height) }
}
