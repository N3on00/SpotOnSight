export async function reloadCoreData(app) {
  await app.action('dashboard').reloadCoreData()
}

export async function reloadDashboardData(app) {
  await app.action('dashboard').reloadDashboardData()
}
