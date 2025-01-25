# 🥷 Wallpy Sensei

> **Note**: Version 2 is in active development on the [`v2-dev`](/tree/v2-dev) branch.

A dynamic wallpaper tool that allows you to change wallpapers based on the time of the day. The idea for this little weekend project came after I came across [this](https://www.mattvince.com/product/zelda-wind-waker-wallpaper-4-pack/) wallpaper pack. You can use it to change your wallpapers 24/7 and even add your own custom wallmaps. Try it!


<p float="left">
  <img src="https://user-images.githubusercontent.com/52672162/190454797-375ca1fa-8864-4aa5-b7d7-b2d689b862df.gif" width="300" />⠀

  <img src="https://user-images.githubusercontent.com/52672162/190465231-2199d54c-72fc-4f69-900a-88d64307f5d1.gif" width="300" />
</p>
<p float="left">
  <img src="https://user-images.githubusercontent.com/52672162/190468715-e7f1a6e8-95b8-4845-8082-9fc7168638b0.gif" width="300" />⠀

  <img src="https://user-images.githubusercontent.com/52672162/190470111-9d209b42-d571-422c-a901-5288056e3c31.gif" width="300" /> 
</p>


## Installation and Setup

Common steps for all operating systems,
1. Clone the repository `git clone https://github.com/siphyshu/wallpy-sensei.git`
2. Move into the directory `cd ./wallpy-sensei`
3. Run the setup.py script `python3 ./setup.py "[wallpack_name]"` (wallpack_name from ./wallpaper-packs dir)

### Windows
1. Open "Task Scheduler" by searching in the start menu
2. Click on "Create Task" from the Actions menu on the right
3. Give it a suitable name such as "Wallpy Sensei Task" and Configure for [Windows 10]
4. Add two triggers: [On Startup], [On a schedule, repeat every 5 minutes indefinitely]
5. Add an action: [Start a program], Point it to the `./wallpy-sensei.py` script
6. Naviagate to Conditions tab and uncheck "Start the task only if the computer is on AC power"

https://user-images.githubusercontent.com/52672162/190489223-657b1fd5-25c9-4c1c-95c7-2d12cb6997c2.mp4