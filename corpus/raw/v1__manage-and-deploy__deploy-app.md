> ## Documentation Index
> Fetch the complete documentation index at: https://docs.michelangelo.land/llms.txt
> Use this file to discover all available pages before exploring further.

# Deploy App

> Deploy your app on TestFlight (iOS) and Google Play (Android).

With Michelangelo.land you can easily **distribute your app** by following a few steps. The Deploy process allows you to publish your application on **TestFlight (iOS)** and **Google Play (Android)**.

1. **Expo and Stores account**:<br />
   * to get started, make sure you have an Expo account. If you don't have one, you can create one here: <a href="https://expo.dev/signup">create an Expo account</a>, or <a href="https://expo.dev/login">log in</a> to your existing account.
   * In addition, to distribute your app on TestFlight (iOS) or Google Play (Android), you'll also need the corresponding **developer accounts for each store**. <br />
     You can find all the details on how to set them up in Expo’s official guide: <a href="https://docs.expo.dev/build/setup/#build-for-app-stores">Build for app stores – Expo Docs</a>

2. **Project on Expo**:<br />
   after logging in to Expo, access the Expo Dashboard and **create a new project**. You will need this to connect Michelangelo.land to your Expo environment and start the Deploy.

3. **Deploy from Michelangelo.land**:<br />
   inside your project on <a href="https://michelangelo.land">Michelangelo.land</a>:
   * Click the ‘<Icon icon="arrow-up-from-bracket" iconType="regular" color="#7c7c7c" size="20" /> **Publish**‘ button in the top-right corner of interface and a popover will open with publish options.

   * Locate the **Deploy iOS & Android** section inside the popover.

   * <Icon icon="pen-field" iconType="regular" color="#7c7c7c" size="20" /> This section is divided into **4 steps** (the values ​​of the fields below are for example):<br />
     1. Enter:<br />
        • `App Name` (your app name)<br />
        • `App Icon` (your app icon)<br />
        Click ‘Next‘
        <video controls autoPlay muted loop playsInline className="w-full aspect-video" src="https://mintcdn.com/michelangeloland/eVXcz9RBB8cp9K1l/videos/deploy-app/deploy-app-step1.mp4?fit=max&auto=format&n=eVXcz9RBB8cp9K1l&q=85&s=1f308603f5d471838c21f1c2ff6806b1" data-path="videos/deploy-app/deploy-app-step1.mp4" />

     2. Enter the Expo project data:<br />
        `ID: "3b2a9f88-7d4e-49a5-92c7-a1b23c45d678"`<br />
        `Owner: "my-michelangelo-app"`<br />
        `Slug: "michelangeloproject"`<br />
        (These data are visible in the Expo Dashboard)<br />
        Click ‘Next‘
        <video controls autoPlay muted loop playsInline className="w-full aspect-video" src="https://mintcdn.com/michelangeloland/eVXcz9RBB8cp9K1l/videos/deploy-app/deploy-app-step2.mp4?fit=max&auto=format&n=eVXcz9RBB8cp9K1l&q=85&s=4fa6ab241d67ba4b226436c1eda8608c" data-path="videos/deploy-app/deploy-app-step2.mp4" />

     3. Enter your Expo Access Token:<br />
        `Token: "zxywvu9876543210abcdefghijklmnopqrstuv"`<br />
        (Always recoverable from the Expo project Dashboard)<br />
        Click ‘Next‘
        <video controls autoPlay muted loop playsInline className="w-full aspect-video" src="https://mintcdn.com/michelangeloland/eVXcz9RBB8cp9K1l/videos/deploy-app/deploy-app-step3.mp4?fit=max&auto=format&n=eVXcz9RBB8cp9K1l&q=85&s=e67da026fddfb0442f81120c814e2112" data-path="videos/deploy-app/deploy-app-step3.mp4" />

     4. Fill in the Store fields according to your needs:<br />
        `iOS Bundle Identifier: "1234567890"` (from TestFlight)<br />
        `Apple App Store Connect App ID: "123456789"` (from Apple App Store Connect)<br />
        `Android Package Name: "ex.com.myapp"` (from Google Play Console)<br />

   * After filling in the required fields, click on the ‘**Submit**‘ button.
     <video controls autoPlay muted loop playsInline className="w-full aspect-video" src="https://mintcdn.com/michelangeloland/eVXcz9RBB8cp9K1l/videos/deploy-app/deploy-app-step4.mp4?fit=max&auto=format&n=eVXcz9RBB8cp9K1l&q=85&s=0571f5726be28c2ee5ddaba6fa68b86c" data-path="videos/deploy-app/deploy-app-step4.mp4" />

4. **Deployment Status**:<br />
   After submitting your data:
   * You will see a message with <Icon icon="rocket-launch" iconType="light" color="#7c7c7c" size="20" /> icon: <br />
     **"Your app is preparing for launch..."**
   * You can check the deploy status through the **status indicator dot** in the top-right corner of the ‘Publish‘ button. It works like a traffic light:<br />
     <Icon icon="circle" iconType="solid" color="#ff8200" size="20" /> *Queue* <br />
     <Icon icon="circle" iconType="solid" color="#1b87d9" size="20" /> *In Progress* <br />
     <Icon icon="circle" iconType="solid" color="#3dc900" size="20" /> *Success* <br />
     <Icon icon="circle" iconType="solid" color="#e20b0b" size="20" /> *Failed* <br />

     In case of error (***Failed***), you can **repeat the procedure** by clicking the ‘Publish‘ button again. The previous data will have to be re-entered for greater security.<br />
     Also, you can contact <a href="https://docs.michelangelo.land/introduction#support">Michelangelo.land support</a> for assistance.

     <video controls autoPlay muted loop playsInline className="w-full aspect-video" src="https://mintcdn.com/michelangeloland/eVXcz9RBB8cp9K1l/videos/deploy-app/deploy-app-status.mp4?fit=max&auto=format&n=eVXcz9RBB8cp9K1l&q=85&s=6312b1f1ad307a2ca2d52c0106faff2e" data-path="videos/deploy-app/deploy-app-status.mp4" />

5. **Distributed App**:<br />
   When the status is ***Success***, the deployment will be completed successfully:

   * in the popover (by clicking on ‘Publish‘) you will find a **direct link to your Expo dashboard** where you can **view the status of your Build and Submit** (submitting the app to the stores).<br />

   Once all the processes have been successfully completed, **your app will be on TestFlight and Google Play**, ready to be shared.
