const salasPermitidas = ["Sala Norte", "Sala Sur", "Sala Multimedia"];
const turnosPermitidos = ["Mañana", "Tarde", "Noche"];

function prepararAreaReservas(req, res, next) {
  res.locals.seccion = "Reservas de salas";
  next();
}

function validarReserva(req, res, next) {
  const valores = req.body ?? {};

  // Extracción estricta y segura de tipos
  const estudiante =
    typeof valores.estudiante === "string" ? valores.estudiante.trim() : "";
  const email = typeof valores.email === "string" ? valores.email.trim() : "";
  const sala = typeof valores.sala === "string" ? valores.sala.trim() : "";
  const fecha = typeof valores.fecha === "string" ? valores.fecha.trim() : "";
  const turno = typeof valores.turno === "string" ? valores.turno.trim() : "";

  const personasRecibidas = valores.personas;
  const personas =
    typeof personasRecibidas === "number" ||
    (typeof personasRecibidas === "string" && personasRecibidas.trim() !== "")
      ? Number(personasRecibidas)
      : NaN;

  const esValido =
    estudiante &&
    email.includes("@") &&
    salasPermitidas.includes(sala) &&
    fecha &&
    turnosPermitidos.includes(turno) &&
    Number.isInteger(personas) &&
    personas >= 1 &&
    personas <= 6;

  if (!esValido) {
    const mensajeError =
      "Comprueba que todos los campos sean correctos, la cantidad de personas (1-6) y que el email contenga @.";

    // Si la petición viene de la API, respondemos JSON
    if (req.baseUrl === "/api/reservas") {
      return res.status(400).json({ error: mensajeError });
    }

    // Si viene del sitio web, renderizamos el formulario HTML
    return res.status(400).render("reservas/nueva", {
      titulo: "Nueva Reserva",
      error: mensajeError,
      valores: valores,
      salasPermitidas,
      turnosPermitidos,
    });
  }

  // Solo pasamos los 6 campos permitidos al controlador
  req.reservaValidada = { estudiante, email, sala, fecha, turno, personas };
  next();
}

module.exports = { prepararAreaReservas, validarReserva };
