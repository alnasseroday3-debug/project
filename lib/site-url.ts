export function getSiteUrl() {
  const productionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  const deploymentUrl = process.env.VERCEL_URL
  const host = productionUrl || deploymentUrl

  return new URL(host ? `https://${host}` : 'http://localhost:3000')
}
