function isUserAllowedToBuyAlcohol(user: User): boolean {
  if (user.age >= LEGAL_DRINKING_AGE) {
    return true;
  } else {
    return false;
  }
}
