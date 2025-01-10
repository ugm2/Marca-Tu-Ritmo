#!/bin/bash

# Force remove the ios directory if it exists
rm -rf ios/

# Run prebuild
npx expo prebuild --platform ios --clean

# Create Podfile.properties.json with the correct team
echo '{
  "expo.jsEngine": "hermes",
  "EX_DEV_CLIENT_NETWORK_INSPECTOR": "true",
  "newArchEnabled": "false",
  "ios.developmentTeam": "Unai Garay Maestre (Personal Team)"
}' > ios/Podfile.properties.json

# Update Xcode scheme to use Release configuration
sed -i '' 's/buildConfiguration = "Debug"/buildConfiguration = "Release"/g' ios/MarcaTuRitmo.xcodeproj/xcshareddata/xcschemes/MarcaTuRitmo.xcscheme

# Update development team in project.pbxproj
sed -i '' 's/DEVELOPMENT_TEAM = "";/DEVELOPMENT_TEAM = "Unai Garay Maestre (Personal Team)";/g' ios/MarcaTuRitmo.xcodeproj/project.pbxproj

echo "✅ Updated Podfile.properties.json with development team"
echo "✅ Updated Xcode scheme to use Release configuration"
echo "✅ Updated development team in project settings" 