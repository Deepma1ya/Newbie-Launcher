; Custom NSIS hooks for Newbie Launcher.
;
; electron-builder includes this file at the top of the generated installer
; script, before MUI2 is loaded. Only static headers may be included here and
; MUI macros may only be used inside macros that are inserted later, so the
; page functions live inside customPageAfterChangeDir.
;
; The Defender helper lives in resources/defender-exclusions.ps1 and is copied
; to $INSTDIR\resources by extraResources. It elevates itself with a single UAC
; prompt and only changes Defender when the user approves.

!include LogicLib.nsh
!include nsDialogs.nsh

!ifndef BUILD_UNINSTALLER
  Var DefenderExclusionsCheckbox
  Var DefenderExclusionsState
!endif

!macro customPageAfterChangeDir
  Function nsDefenderPageCreate
    ; The stamp is written after a successful run, so re-installs and
    ; interactive updates do not ask for administrator approval again.
    IfFileExists "$APPDATA\NewbieLauncher\defender-exclusions.json" 0 nsDefenderPageShow
      Abort

    nsDefenderPageShow:
    !insertmacro MUI_HEADER_TEXT "Windows Defender" "Keep antivirus scans out of the launcher folders"
    nsDialogs::Create 1018
    Pop $0
    ${If} $0 == error
      Abort
    ${EndIf}

    ${NSD_CreateCheckbox} 0 0 100% 12u "Exclude the launcher and game folders from Microsoft Defender scans"
    Pop $DefenderExclusionsCheckbox
    ${NSD_SetState} $DefenderExclusionsCheckbox ${BST_CHECKED}

    ${NSD_CreateLabel} 0 18u 100% 26u "Windows scans every file the launcher downloads, which slows down installing Minecraft, Java runtimes and modpacks. These folders are skipped by Microsoft Defender:"
    Pop $0
    ${NSD_CreateLabel} 0 48u 100% 10u "    - the launcher install folder"
    Pop $0
    ${NSD_CreateLabel} 0 60u 100% 10u "    - the launcher data folder (game files, caches, downloads)"
    Pop $0
    ${NSD_CreateLabel} 0 76u 100% 20u "Windows asks for administrator approval once. You can change this later in Settings."
    Pop $0

    nsDialogs::Show
  FunctionEnd

  Function nsDefenderPageLeave
    ${NSD_GetState} $DefenderExclusionsCheckbox $DefenderExclusionsState
  FunctionEnd

  Page custom nsDefenderPageCreate nsDefenderPageLeave
!macroend

!macro customInstall
  ${If} $DefenderExclusionsState == ${BST_CHECKED}
    ${If} ${FileExists} "$INSTDIR\resources\defender-exclusions.ps1"
      DetailPrint "Adding Windows Defender exclusions..."
      nsExec::ExecToLog 'powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "$INSTDIR\resources\defender-exclusions.ps1" -Mode add -Paths "$INSTDIR|$APPDATA\NewbieLauncher|$LOCALAPPDATA\newbie-launcher" -Stamp "$APPDATA\NewbieLauncher\defender-exclusions.json"'
      Pop $0
      StrCmp $0 "0" nsDefenderInstallDone
        DetailPrint "Windows Defender exclusions were not added (code $0). You can add them later in Settings."
      nsDefenderInstallDone:
    ${EndIf}
  ${EndIf}
!macroend

!macro customUnInstall
  ; Updates run the old uninstaller with /UPDATE, so only real uninstalls ask.
  ${IfNot} ${isUpdated}
    ${If} ${FileExists} "$APPDATA\NewbieLauncher\defender-exclusions.json"
      ${If} ${FileExists} "$INSTDIR\resources\defender-exclusions.ps1"
        ${IfNot} ${Silent}
          MessageBox MB_YESNO|MB_ICONQUESTION "Remove the Windows Defender exclusions that Newbie Launcher added?" IDNO nsDefenderUninstallDone
        ${EndIf}
        nsExec::ExecToLog 'powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "$INSTDIR\resources\defender-exclusions.ps1" -Mode remove -Paths "$INSTDIR|$APPDATA\NewbieLauncher|$LOCALAPPDATA\newbie-launcher"'
        Pop $0
        Delete "$APPDATA\NewbieLauncher\defender-exclusions.json"
      ${EndIf}
    ${EndIf}
  ${EndIf}
  nsDefenderUninstallDone:
!macroend
