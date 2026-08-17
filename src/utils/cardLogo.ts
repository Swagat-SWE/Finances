const publicAsset = (path: string) => `${import.meta.env.BASE_URL}${path}`

export const cardLogoFor = (institution: string) => {
  const name = institution.toLocaleLowerCase()
  if (name.includes('american express') || name.includes('amex')) return publicAsset('logo/Amex.png')
  if (name.includes('apple')) return publicAsset('logo/Apple.png')
  if (name.includes('capital one')) return publicAsset('logo/CapitalOne.png')
  if (name.includes('chase')) return publicAsset('logo/Chase.png')
  if (name.includes('discover')) return publicAsset('logo/Discover.png')
  if (name.includes('paypal')) return publicAsset('logo/PayPal.png')
  if (name.includes('wells fargo')) return publicAsset('logo/WellsFargo.png')
  return undefined
}
