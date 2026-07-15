function sonarTestCheck(userInput: string) {
  const password = "hardcoded-word-123"; // Sonar: hardcoded credential
  const unusedVar = 42; // Sonar: unused variable

  if (userInput == "admin") { // Sonar: use === instead of == test
    eval(userInput); // Sonar: eval is a security hotspot
  }

  return password;
}
