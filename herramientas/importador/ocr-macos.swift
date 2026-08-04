// ---------------------------------------------------------------------------
// Lector de texto de macOS (framework Vision), el mismo que usa Vista Previa
// cuando seleccionas texto dentro de una imagen.
//
// Recibe la ruta de una imagen y escribe en la salida un JSON con cada línea
// de texto y su posición, para poder cruzarla con la banda verde.
//
// Se compila solo la primera vez desde ocr-macos.mjs. No hay que tocarlo.
// ---------------------------------------------------------------------------

import Foundation
import Vision
import AppKit

func salirConError(_ mensaje: String, _ codigo: Int32) -> Never {
    FileHandle.standardError.write(mensaje.data(using: .utf8)!)
    exit(codigo)
}

guard CommandLine.arguments.count > 1 else {
    salirConError("Falta la ruta de la imagen\n", 64)
}
let ruta = CommandLine.arguments[1]

guard let imagen = NSImage(contentsOfFile: ruta) else {
    salirConError("No se ha podido abrir la imagen: \(ruta)\n", 65)
}
guard let cg = imagen.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    salirConError("No se ha podido leer el contenido de la imagen\n", 66)
}

let solicitud = VNRecognizeTextRequest()
// "accurate" es más lento que "fast" pero sigue siendo cuestión de décimas,
// y con texto pequeño de pantalla la diferencia de acierto es notable.
solicitud.recognitionLevel = .accurate
solicitud.recognitionLanguages = ["es-ES", "es"]
solicitud.usesLanguageCorrection = true

let manejador = VNImageRequestHandler(cgImage: cg, options: [:])
do {
    try manejador.perform([solicitud])
} catch {
    salirConError("Vision ha fallado: \(error.localizedDescription)\n", 67)
}

let ancho = CGFloat(cg.width)
let alto = CGFloat(cg.height)
var lineas: [[String: Any]] = []

for observacion in (solicitud.results ?? []) {
    guard let candidato = observacion.topCandidates(1).first else { continue }
    let texto = candidato.string.trimmingCharacters(in: .whitespacesAndNewlines)
    if texto.isEmpty { continue }

    // Vision devuelve la caja normalizada de 0 a 1 y con el origen ABAJO a la
    // izquierda. Aquí se pasa a píxeles y se le da la vuelta al eje vertical,
    // que es como trabaja el resto del importador.
    let caja = observacion.boundingBox
    lineas.append([
        "texto": texto,
        "izquierda": Int((caja.minX * ancho).rounded()),
        "derecha": Int((caja.maxX * ancho).rounded()),
        "arriba": Int(((1 - caja.maxY) * alto).rounded()),
        "abajo": Int(((1 - caja.minY) * alto).rounded()),
        "conf": Int((candidato.confidence * 100).rounded()),
    ])
}

let salida: [String: Any] = ["ancho": Int(ancho), "alto": Int(alto), "lineas": lineas]
guard let datos = try? JSONSerialization.data(withJSONObject: salida, options: []) else {
    salirConError("No se ha podido componer la respuesta\n", 68)
}
FileHandle.standardOutput.write(datos)
