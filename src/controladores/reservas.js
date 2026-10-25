function crearControladorReservas(servicioReservas) {
  const salasPermitidas = ["Sala Norte", "Sala Sur", "Sala Multimedia"];
  const turnosPermitidos = ["Mañana", "Tarde", "Noche"];

  async function estado(req, res) {
    res.json({
      servicio: "activo",
      reservas: await servicioReservas.contar(),
      solicitudId: res.locals.solicitudId,
    });
  }

  // --- Controladores HTML (Sitio Web) ---
  async function listar(req, res) {
    const reservas = await servicioReservas.listar();
    res.render("reservas/lista", { titulo: "Salas reservadas", reservas });
  }

  function mostrarFormulario(req, res) {
    res.render("reservas/nueva", {
      titulo: "Nueva Reserva",
      error: null,
      valores: {},
      salasPermitidas,
      turnosPermitidos,
    });
  }

  async function mostrarDetalle(req, res) {
    const reserva = await servicioReservas.obtenerPorId(req.params.id);
    if (!reserva) {
      return res.status(404).render("no-encontrado", {
        titulo: "Reserva no encontrada",
        mensaje: "No existe una reserva con ese identificador.",
      });
    }
    res.render("reservas/detalle", {
      titulo: `Reserva #${reserva.id}`,
      reserva,
    });
  }

  async function crear(req, res) {
    await servicioReservas.crear(req.reservaValidada);
    res.redirect("/reservas");
  }

  // --- Controladores JSON (API) ---
  async function listarApi(req, res) {
    const reservas = await servicioReservas.listar(req.query.sala);
    res.json(reservas);
  }

  async function obtenerApi(req, res) {
    const reserva = await servicioReservas.obtenerPorId(req.params.id);
    if (!reserva) {
      return res.status(404).json({ error: "Reserva no encontrada." });
    }
    res.json(reserva);
  }

  async function crearApi(req, res) {
    const reserva = await servicioReservas.crear(req.reservaValidada);
    // Retornamos 201 Created y la cabecera Location con la ruta de la nueva reserva
    res.location(`/api/reservas/${reserva.id}`).status(201).json(reserva);
  }

  return {
    estado,
    listar,
    mostrarFormulario,
    mostrarDetalle,
    crear,
    listarApi,
    obtenerApi,
    crearApi,
  };
}

module.exports = { crearControladorReservas };
