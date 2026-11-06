; Custom NSIS hooks for Newbie Launcher.
;
; electron-builder includes this file at the top of the generated installer
; script, before MUI2 is loaded. Only static headers may be included here and
; MUI macros may only be used inside macros that are inserted later, so the
; page functions live inside the page macros.
;
; The helpers live in resources/ and are shipped by extraResources:
;   defender-exclusions.ps1  add/remove Defender exclusions (install + app)
;   uninstall-cleanup.ps1    delete launcher data and remove exclusions

!include LogicLib.nsh
!include nsDialogs.nsh
!include WinMessages.nsh

!ifndef BUILD_UNINSTALLER
  Var DefenderExclusionsCheckbox
  Var DefenderExclusionsState
!endif

!ifdef BUILD_UNINSTALLER
  Var UninstallQuote
  Var UninstallPurgeCheckbox
  Var UninstallPurgeState
!endif

; ---------------------------------------------------------------------------
; Install: optional Windows Defender exclusions
; ---------------------------------------------------------------------------

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

; ---------------------------------------------------------------------------
; Uninstall: farewell page, full data purge, Defender cleanup
; ---------------------------------------------------------------------------

!macro customUnWelcomePage
  Function un.nsUninstallPageCreate
    !insertmacro MUI_HEADER_TEXT "Uninstall Newbie Launcher" "One last look before the road"

    ; A little farewell, picked at random.
    System::Call 'kernel32::GetTickCount()i .r1'
    IntOp $R1 $R1 % 17
    StrCpy $UninstallQuote "May we cross paths again, stranger."
    StrCmp $R1 0 nsUninstallQuoteReady
    StrCpy $UninstallQuote "Every goodbye leaves room for another hello."
    StrCmp $R1 1 nsUninstallQuoteReady
    StrCpy $UninstallQuote "Perhaps our paths will cross in another chapter."
    StrCmp $R1 2 nsUninstallQuoteReady
    StrCpy $UninstallQuote "It was lovely having you here. Until next time."
    StrCmp $R1 3 nsUninstallQuoteReady
    StrCpy $UninstallQuote "Some journeys end, but memories remain."
    StrCmp $R1 4 nsUninstallQuoteReady
    StrCpy $UninstallQuote "Until fate brings you back to us."
    StrCmp $R1 5 nsUninstallQuoteReady
    StrCpy $UninstallQuote "And just like that, our paths diverge."
    StrCmp $R1 6 nsUninstallQuoteReady
    StrCpy $UninstallQuote "A stranger once, a visitor for a while, a stranger again."
    StrCmp $R1 7 nsUninstallQuoteReady
    StrCpy $UninstallQuote "The story pauses here. Perhaps not forever."
    StrCmp $R1 8 nsUninstallQuoteReady
    StrCpy $UninstallQuote "Until we meet in another corner of the universe."
    StrCmp $R1 9 nsUninstallQuoteReady
    StrCpy $UninstallQuote "Farewell, wanderer. The world awaits."
    StrCmp $R1 10 nsUninstallQuoteReady
    StrCpy $UninstallQuote "Not all goodbyes are meant to be forever."
    StrCmp $R1 11 nsUninstallQuoteReady
    StrCpy $UninstallQuote "Until another time."
    StrCmp $R1 12 nsUninstallQuoteReady
    StrCpy $UninstallQuote "Safe travels, stranger."
    StrCmp $R1 13 nsUninstallQuoteReady
    StrCpy $UninstallQuote "Perhaps we'll meet again."
    StrCmp $R1 14 nsUninstallQuoteReady
    StrCpy $UninstallQuote "Until our next encounter."
    StrCmp $R1 15 nsUninstallQuoteReady
    StrCpy $UninstallQuote "Go well, fellow wanderer."
    nsUninstallQuoteReady:

    nsDialogs::Create 1018
    Pop $0
    ${If} $0 == error
      Abort
    ${EndIf}

    ${NSD_CreateLabel} 0 0 100% 24u '"$UninstallQuote"'
    Pop $0
    ${NSD_CreateLabel} 0 30u 100% 24u "Newbie Launcher will be removed for your Windows account. This cannot be undone."
    Pop $0
    ${NSD_CreateCheckbox} 0 58u 100% 26u "Also delete game files, instances, worlds, mods, servers, backups, caches and launcher settings"
    Pop $UninstallPurgeCheckbox
    ${NSD_SetState} $UninstallPurgeCheckbox ${BST_CHECKED}
    ${NSD_CreateLabel} 0 88u 100% 28u "The launcher data folder is deleted wherever you moved it. Windows Defender exclusions added by Newbie are removed as well."
    Pop $0

    GetDlgItem $0 $HWNDPARENT 1
    SendMessage $0 ${WM_SETTEXT} 0 "STR:Uninstall"

    nsDialogs::Show
  FunctionEnd

  Function un.nsUninstallPageLeave
    ${NSD_GetState} $UninstallPurgeCheckbox $UninstallPurgeState
  FunctionEnd

  UninstPage custom un.nsUninstallPageCreate un.nsUninstallPageLeave
!macroend

!macro customUnInstall
  ; Updates run the old uninstaller with /UPDATE, so only real uninstalls clean up.
  ${IfNot} ${isUpdated}
    StrCpy $R9 "0"
    ${If} $UninstallPurgeState == ${BST_CHECKED}
      StrCpy $R9 "1"
    ${ElseIf} ${Silent}
      StrCpy $R9 "1"
    ${EndIf}

    ; Scripted uninstalls can keep their data with /KEEPAPPDATA.
    ${GetParameters} $R8
    ${GetOptions} $R8 "/KEEPAPPDATA" $R7
    ${IfNot} ${Errors}
      StrCpy $R9 "0"
    ${EndIf}

    ${If} ${FileExists} "$INSTDIR\resources\uninstall-cleanup.ps1"
      StrCpy $R8 "$TEMP\newbie-uninstall-status.txt"
      Delete "$R8"
      DetailPrint "Removing launcher files and Windows Defender exclusions..."
      nsExec::ExecToLog 'powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "$INSTDIR\resources\uninstall-cleanup.ps1" -InstallDir "$INSTDIR" -PurgeData "$R9" -Status "$R8"'
      Pop $0
      StrCpy $R5 ""
      ${If} ${FileExists} "$R8"
        FileOpen $R7 "$R8" r
        nsUninstallStatusLoop:
          ClearErrors
          FileRead $R7 $R6
          IfErrors nsUninstallStatusDone
          StrCpy $R5 "$R5$R6$\r$\n"
          Goto nsUninstallStatusLoop
        nsUninstallStatusDone:
        FileClose $R7
      ${EndIf}
      StrCmp $0 "0" nsUninstallCleanupOk
        ${If} $R5 == ""
          StrCpy $R5 "Some launcher files could not be deleted. Restart Windows and run the uninstaller again."
        ${EndIf}
        MessageBox MB_ICONEXCLAMATION|MB_OK "$R5"
        Goto nsUninstallCleanupDone
      nsUninstallCleanupOk:
        ${If} $R5 != ""
          DetailPrint "$R5"
        ${EndIf}
      nsUninstallCleanupDone:
      Delete "$R8"
    ${EndIf}
  ${EndIf}
!macroend
