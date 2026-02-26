**CacheFlow**

Revised Build Plan + Strategic Recommendations

v5.0 · February 2026 · CONFIDENTIAL

  -------------------------------------------------------------------------
  **Project**           **Pilot      **Stack**                **Day
                        Target**                              Status**
  --------------------- ------------ ------------------------ -------------
  CacheFlow --- Unified May 21, 2026 Node.js 22 · Express 5 · Day 34
  Cloud + VPS Storage                PostgreSQL 17 · Next.js  Complete

  -------------------------------------------------------------------------

**01 Plan Comparison: v4 vs Recommended v5**

The existing v4 plan is well-structured with strong governing laws and a
clear day-by-day cadence. The recommendations below are surgical
additions --- not a rebuild. Three new dimensions are added: VPS/SFTP as
a storage provider, file browser UI enhancements, and an optional office
document preview layer.

**Alignment Assessment**

  ----------------------------------------------------------------------------
  **Area**           **v4 Plan**           **v5 Recommendation**  **Action**
  ------------------ --------------------- ---------------------- ------------
  Core sync pipeline Hash verification,    Keep exactly as-is     **✅ KEEP**
  (Days 35--50)      conflict detection,                          
                     quota --- solid                              

  Next.js file       List/grid view,       Add VPS provider       **🔄
  browser (Days      upload, share links,  card + SFTP connection REVISE**
  51--70)            breadcrumb            flow                   

  Semantic search    pgvector embeddings,  Keep --- already well  **✅ KEEP**
  (Days 71--75)      intent search         planned                

  WebDAV (Days       Pilot bridge,         Keep as pilot bridge   **✅ KEEP**
  76--78)            post-MVP FUSE daemon  --- FUSE remains       
                                           post-MVP               

  Zero-retention     New, addresses        Keep --- critical for  **✅ KEEP**
  middleware (Day    auditor directive     trust/marketing        
  80)                                                             

  AI Merge           Expanded to .py .js   Keep --- good scope    **✅ KEEP**
  multi-format (Day  .tsx .csv .json                              
  85)                                                             

  VPS/SFTP as        Not in plan           Add as Phase 2b        **🆕 NEW**
  storage provider                         provider (Days 57--58  
                                           revised)               

  Provider           Implicit in file      Explicit unified       **🔄
  connection         browser               provider hub with      REVISE**
  dashboard                                per-provider health    

  Office document    Not in plan           Add                    **🆕 NEW**
  preview/edit                             Collabora/OnlyOffice   
                                           integration            
                                           (post-pilot roadmap)   

  Affiliate / \"Get  Not in plan           Add to file browser UI **🆕 NEW**
  more storage\"                           (Day 69 revised)       
  panel                                                           

  Mobile PWA         Not in plan           Add PWA manifest +     **🆕 NEW**
                                           service worker (Day 70 
                                           revised)               

  Duplicate          Not in plan           Post-pilot roadmap     **🆕 NEW**
  detection                                item                   
  ----------------------------------------------------------------------------

**02 New Strategic Philosophy**

The original plan positions CacheFlow as a sync/backup tool. The revised
philosophy --- informed by MultCloud competitor research and real user
pain points --- positions it as a unified storage OS. The distinction
matters for marketing, feature priority, and monetization.

**Core Positioning Shift**

  -------------------------------------------------------------------------
  **Dimension**    **Original**            **Revised**
  ---------------- ----------------------- --------------------------------
  Tagline          \"Sync your files       \"All your storage. One place.
                   across clouds\"         Your files never leave your
                                           hands.\"

  Primary user     Power users comfortable Anyone paying for cloud storage
                   with sync tools         or with unused VPS space

  Key              AI-powered conflict     Browser-native privacy +
  differentiator   merge                   mobile-first + VPS integration

  Monetization     Not specified           Free (3 providers) → Pro
                                           \$4.99/mo → affiliate
                                           commissions

  Trust signal     Zero-retention          \"Files never touch our
                   processing              servers\" --- client-side OAuth
                                           tokens
  -------------------------------------------------------------------------

**Why VPS Storage Is the Killer Feature**

Every VPS provider gives 50--200GB of block storage. Most renters use
less than 5% of it for actual files --- the rest sits idle. CacheFlow
can expose that idle storage as a first-class provider alongside Google
Drive and OneDrive. This is something MultCloud, Air Explorer, and every
other competitor completely ignores.

  -------------------------------------------------------------------------
  **VPS Provider** **Typical Free  **Protocol**   **Notes**
                   Storage**                      
  ---------------- --------------- -------------- -------------------------
  OCI (your own)   50--200 GB      SFTP / SSH     Already running CacheFlow
                                                  server here

  Hetzner          20--80 GB       SFTP           Popular in EU, cheap ARM
                                                  plans

  DigitalOcean     25--100 GB      SFTP / Spaces  S3-compatible API
                                   S3             available

  Vultr            25--100 GB      SFTP / Object  S3-compatible
                                   Storage        

  Linode/Akamai    25--100 GB      SFTP / Object  S3-compatible
                                   Storage        

  Any Linux VPS    Varies          SFTP / WebDAV  Generic SSH key auth
  -------------------------------------------------------------------------

**03 VPS / SFTP Provider --- Implementation Spec**

**Connection Flow**

VPS connection should feel as simple as connecting Google Drive. The
user enters 4 fields, clicks Connect, and gets a quota bar showing their
server\'s disk usage. No rclone, no CLI, no SSH key management beyond a
paste.

**Connection UI Fields**

  -----------------------------------------------------------------------
  **Field**          **Type**      **Notes**
  ------------------ ------------- --------------------------------------
  Server hostname/IP Text          e.g. 100.91.230.7 or myserver.com

  Port               Number        Default 22, editable

  Username           Text          e.g. ubuntu, sanjay

  Auth method        Toggle:       Key paste recommended for security
                     Password /    
                     SSH Key       

  Password or        Password /    Never sent to CacheFlow server ---
  Private Key        Textarea      used only for SFTP session

  Root path          Text          e.g. /home/sanjay/files --- default /

  Display name       Text          e.g. \"My OCI Server\", \"Hetzner
                                   VPS\"
  -----------------------------------------------------------------------

**Backend Implementation**

SFTP requires server-side execution --- this is the one provider that
cannot be purely client-side due to SSH protocol requirements. The
existing OCI server is already the right place for this.

-   Add ssh2 npm package to Express backend for SFTP connections

-   SFTP credentials encrypted with AES-256 before storage in PostgreSQL

-   Credentials stored per-user in new vps_connections table

-   All SFTP file operations proxied through existing Express API ---
    > same interface as other providers

-   Quota: run df -h via SSH exec, parse output for used/total

-   File listing: SFTP readdir, map to standard FileMetadata interface

-   Upload/download: stream through Express, never write to OCI disk

**vps_connections Schema**

CREATE TABLE vps_connections (\
id UUID PRIMARY KEY,\
user_id UUID REFERENCES users(id),\
display_name TEXT,\
host TEXT, port INTEGER DEFAULT 22,\
username TEXT,\
auth_type TEXT CHECK (auth_type IN (\'password\', \'key\')),\
credentials_enc BYTEA, \-- AES-256 encrypted\
root_path TEXT DEFAULT \'/\',\
status TEXT DEFAULT \'connected\',\
last_seen TIMESTAMPTZ,\
created_at TIMESTAMPTZ DEFAULT NOW()\
);

**04 File Browser UI Enhancements**

The v4 plan has a solid file browser foundation (Days 54--70). The
additions below are layered on top --- no restructuring needed.

**Provider Hub (Replaces/Extends Day 59)**

A dedicated provider management screen --- the first thing new users see
before the file browser. Shows all connected and available providers
with a unified storage ring chart.

  -----------------------------------------------------------------------
  **Component**      **Description**
  ------------------ ----------------------------------------------------
  Combined storage   Donut chart showing total used vs free across all
  ring               providers. Click segment to filter file browser to
                     that provider.

  Provider cards     One card per connected provider: icon, name,
                     used/total bar, last synced, health dot
                     (green/yellow/red), disconnect button.

  Add provider       \"Connect more storage\" --- cards for unconnected
  section            providers showing free tier size and Connect button.

  VPS card           Separate \"Add your VPS server\" card with a server
                     icon --- distinct from cloud provider cards
                     visually.

  Warning banner     Appears when any provider \>80% full. Shows which
                     provider and estimated days remaining.
  -----------------------------------------------------------------------

**Enhanced File Browser (Days 54--65 additions)**

  --------------------------------------------------------------------------
  **Feature**            **v4 Plan**        **v5 Addition**        **Day**
  ---------------------- ------------------ ---------------------- ---------
  Provider indicator     Not specified      Colored dot + provider 54
                                            icon on each file row  

  Cross-provider copy    Not in plan        Right-click → Copy to  57
                                            → provider picker      
                                            modal                  

  Cross-provider move    Not in plan        Right-click → Move to  57
                                            → with                 
                                            delete-after-upload    
                                            confirmation           

  VPS file listing       Not in plan        SFTP readdir surfaced  58
                                            in unified browser     

  Duplicate badge        Not in plan        Yellow badge on files  65
                                            that exist on 2+       
                                            providers              

  \"Get more storage\"   Not in plan        Sidebar widget: unused 69
  panel                                     providers with free    
                                            tier sizes + affiliate 
                                            links                  

  PWA manifest           Not in plan        manifest.json +        70
                                            service worker ---     
                                            installable on mobile  
  --------------------------------------------------------------------------

**05 Office Suite Integration --- Complexity Assessment**

The question: is integrating an open-source office suite too
complicated? Short answer: for the pilot (May 21), yes --- skip it. For
post-pilot, it is very achievable and is a genuine differentiator. Here
is the honest breakdown.

**Options Compared**

  ---------------------------------------------------------------------------------------
  **Option**      **What it is**       **Complexity**   **Self-hosted?**   **Verdict**
  --------------- -------------------- ---------------- ------------------ --------------
  Collabora       LibreOffice in a     Medium           Yes --- Docker     Best option
  Online          Docker container,                     image              post-pilot
                  browser UI via                                           
                  iframe                                                   

  OnlyOffice Docs Full office suite,   Medium           Yes --- Docker     Strong
                  Docker, REST API                      image              alternative
                  integration                                              

  Google Docs     Embed Google Docs    Low              No --- Google      Good for
  viewer          viewer for preview                    servers            preview-only
                  only (no edit)                                           MVP

  Microsoft       WOPI protocol        High             No --- Microsoft   Too complex
  Office Online   integration                           servers            for now

  Monaco Editor   VS Code editor in    Low              Yes --- npm        Easy win for
  (code only)     browser --- for .js                   package            code files
                  .py .ts .json                                            
  ---------------------------------------------------------------------------------------

**Recommended Approach --- Two Tiers**

**Tier 1 --- Pilot (include in Day 89)**

-   Google Docs viewer iframe for .docx .xlsx .pptx .pdf --- read-only
    > preview, zero infrastructure

-   Monaco Editor for .js .py .ts .json .md .txt --- full editing in
    > browser, already used internally by VS Code

-   Both require zero new Docker containers --- pure frontend additions

-   Monaco is already a dependency candidate since Day 64 side-by-side
    > diff UI is in the plan

**Tier 2 --- Post-Pilot Month 2 (Collabora Online)**

-   Add collabora/code Docker container to existing docker-compose.yml
    > on OCI

-   Implement WOPI REST protocol endpoint in Express: GET
    > /wopi/files/:id, GET /wopi/files/:id/contents, POST
    > /wopi/files/:id/contents

-   Wire file browser \"Open\" button to Collabora iframe for .docx
    > .xlsx .pptx

-   Full read-write editing, no file ever leaves your OCI server

-   Estimated: 5--7 days of work, fits within Month 2 roadmap

Collabora is not too complicated --- it is a Docker container with a
REST API. It is the same technology that powers Nextcloud Office and
dozens of enterprise deployments. The WOPI integration is well
documented. The reason to defer to post-pilot is simply timeline
protection, not technical difficulty.

**06 Revised Day-by-Day Plan: Days 35--90**

Changes from v4 shown in status column. ✅ KEEP = unchanged. 🔄 REVISE =
same day, expanded scope. 🆕 NEW = new deliverable added to existing
day.

**Phase 2 --- Sync Hardening (Days 35--50)**

Unchanged from v4. All 10 governing laws apply. Proceed as documented.

  ------------------------------------------------------------------------------
  **Day**   **Title**        **Deliverable**                        **Status**
  --------- ---------------- -------------------------------------- ------------
  35--50    Sync Hardening   Hash verification, conflict detection, **✅ KEEP**
                             quota enforcement, Prometheus,         
                             Grafana, worker Docker, temp           
                             exclusion, safe deletion, structured   
                             logs                                   

  ------------------------------------------------------------------------------

**Phase 3 --- Next.js Web UI (Days 51--70)**

Revised days shown individually. Core structure from v4 preserved ---
additions are surgical.

  -------------------------------------------------------------------------------
  **Day**   **Title**          **v5 Addition**                       **Status**
  --------- ------------------ ------------------------------------- ------------
  51        Next.js Scaffold   No change                             **✅ KEEP**

  52        API Client + Auth  No change                             **✅ KEEP**

  53        Login Page         No change                             **✅ KEEP**

  54        File Browser ---   Add provider color dot + icon to each **🔄
            List               file row                              REVISE**

  55        Upload Component   Add provider selector dropdown on     **🔄
                               upload (which drive to upload to)     REVISE**

  56        File Operations    No change                             **✅ KEEP**

  57        Context Menu       Add \"Copy to provider\" and \"Move   **🔄
                               to provider\" items ---               REVISE**
                               cross-provider transfer               

  58        Grid/List + Sort   Add VPS/SFTP provider file listing to **🔄
                               unified browser                       REVISE**

  59        Provider Hub       REVISED: Replace basic quota bar with **🔄
                               full Provider Hub screen --- donut    REVISE**
                               chart, provider cards, Add VPS card,  
                               health dots, warning banner           

  60        Breadcrumb         No change                             **✅ KEEP**
            Navigation                                               

  61        Share Link Dialog  No change                             **✅ KEEP**

  62        Public Share Page  No change                             **✅ KEEP**

  63        Conflict List Page No change                             **✅ KEEP**

  64        Side-by-Side Diff  Add Monaco Editor for code file diffs **🔄
            UI                 (.js .py .ts .json)                   REVISE**

  65        Resolution Buttons Add duplicate badge --- yellow        **🔄
                               indicator on files present on 2+      REVISE**
                               providers                             

  66        Admin Dashboard    Add VPS connection health to worker   **🔄
                               status panel                          REVISE**

  67        User Management    No change                             **✅ KEEP**

  68        Transfer Chart     Add VPS transfer stats to chart       **🔄
                               alongside cloud providers             REVISE**

  69        Cost Projection    ADD: \"Get more free storage\"        **🔄
                               sidebar panel with unconnected        REVISE**
                               providers + affiliate links           

  70        Audit Log Viewer + ADD: PWA manifest.json + service      **🔄
            PWA                worker registration --- makes app     REVISE**
                               installable on mobile                 
  -------------------------------------------------------------------------------

**Phase 4 --- Semantic Search + Immutability (Days 71--75)**

Unchanged from v4.

**Phase 5 --- WebDAV, Security, Zero-Retention (Days 76--85)**

Day 80 and Day 85 revised per auditor directives (already in v4). One
addition: Day 85 build day now also includes Monaco Editor for document
preview (Tier 1 office suite).

  --------------------------------------------------------------------------------
  **Day**   **Title**               **v5 Addition**                   **Status**
  --------- ----------------------- --------------------------------- ------------
  76--79    WebDAV + Rate Limiting  No change from v4                 **✅ KEEP**

  80        Zero-Retention +        No change from v4 --- critical    **✅ KEEP**
            Marketing Alignment     gate                              

  81--84    Systemd, Overflow,      No change from v4                 **✅ KEEP**
            Audit, Failover                                           

  85        AI Merge Multi-Format   ADD: Integrate Google Docs viewer **🔄
            (Build)                 iframe for .docx .xlsx .pdf       REVISE**
                                    preview in file browser           

  86        AI Merge Integration    No change from v4                 **✅ KEEP**
            Test                                                      
  --------------------------------------------------------------------------------

**Final Testing & Pilot Release (Days 87--90)**

  -------------------------------------------------------------------------------
  **Day**   **Title**          **v5 Addition**                       **Status**
  --------- ------------------ ------------------------------------- ------------
  87        E2E System Test    Add VPS provider to test flow:        **🔄
                               connect VPS → list files → copy to    REVISE**
                               Google Drive → verify                 

  88        Performance        Add VPS transfer benchmark: SFTP      **🔄
            Baseline           read/write latency target \<3s for    REVISE**
                               1MB                                   

  89        Documentation +    No change from v4                     **✅ KEEP**
            Security Page                                            

  90        🎉 PILOT RELEASE   May 21, 2026 --- all checklist items  **⬜
                               verified                              PENDING**
  -------------------------------------------------------------------------------

**07 Revised Day 90 Pilot Checklist**

Items 1--17 from v4 unchanged. New items 18--21 added for VPS, PWA, and
office preview.

  -----------------------------------------------------------------------------
  **\#**   **Item**         **Acceptance Criteria**                **Status**
  -------- ---------------- -------------------------------------- ------------
  1--17    All v4 checklist As defined in v4 document ---          **⬜
           items            unchanged                              PENDING**

  18       🆕 VPS provider  User can connect an SFTP server, see   **🆕 NEW**
           connected        disk quota, browse files in unified    
                            browser                                

  19       🆕               File on VPS can be copied to Google    **🆕 NEW**
           Cross-provider   Drive and vice versa via right-click   
           file copy        menu                                   

  20       🆕 PWA           App shows \"Add to Home Screen\" on    **🆕 NEW**
           installable      Android Chrome and iOS Safari. Works   
                            offline for cached views               

  21       🆕 Document      Clicking .docx or .pdf in file browser **🆕 NEW**
           preview          opens Google Docs viewer. .js .py open 
                            in Monaco Editor                       
  -----------------------------------------------------------------------------

**08 Post-Pilot Roadmap (Month 2--6)**

  ---------------------------------------------------------------------------------
  **Priority**   **Feature**               **Effort**   **Why**
  -------------- ------------------------- ------------ ---------------------------
  P0             Collabora Online (full    5--7 days    Docker container + WOPI
                 document editing)                      API. Biggest differentiator
                                                        vs MultCloud

  P0             Native desktop sync       3--4 weeks   Already in v4 roadmap.
                 daemon (WinFSP / macFUSE)              Replaces WebDAV pilot
                                                        bridge

  P1             Kimi K2 / DeepSeek R1 for 1 day        Swap Anthropic API calls to
                 AI merge (cheaper)                     cheaper models via LiteLLM
                                                        --- same endpoint

  P1             Duplicate detection       3--4 days    Compare filename + size.
                 across providers                       Surface in cleanup tab

  P1             Stale file detection +    2--3 days    Files \>90 days unused on
                 cleanup                                \>70% full provider ---
                                                        suggest move

  P1             Capacity forecasting      2 days       Based on 30-day upload
                                                        rate, predict fill date

  P2             S3-compatible object      3--4 days    Cheap cold storage tier ---
                 storage (Backblaze B2,                 automatic overflow routing
                 Wasabi)                                

  P2             Semantic search expansion 1 week       CLIP model for photo search
                 (image embeddings)                     by content

  P2             Multi-modal AI merge      Research     Longer term --- merge
                 (image + doc)                          image-embedded documents

  P3             Client-side AI merge      2--3 weeks   True zero-knowledge ---
                 (Ollama local model)                   merge runs in
                                                        browser/daemon, never
                                                        leaves device
  ---------------------------------------------------------------------------------

**09 Monetization Strategy**

**Pricing Tiers**

  --------------------------------------------------------------------------------
  **Tier**   **Price**      **Providers**   **Features**
  ---------- -------------- --------------- --------------------------------------
  Free       \$0/month      Up to 3         File browser, basic copy/move, 1 VPS
                            providers       connection, PWA

  Pro        \$4.99/month   Unlimited       Auto-router, duplicate detection,
                            providers       semantic search, document preview,
                                            unlimited VPS connections

  Team       \$12/month     Unlimited +     Everything in Pro + admin dashboard +
                            shared          shared folders + audit log
  --------------------------------------------------------------------------------

**Affiliate Revenue**

Conservative estimate: if 1,000 free users convert to paid storage
through affiliate links at \$15 average commission = \$15,000 one-time.
At 10,000 users this becomes material recurring income. Zero marginal
cost --- just link tracking.

  ------------------------------------------------------------------------
  **Provider**   **Program**      **Commission**   **Note**
  -------------- ---------------- ---------------- -----------------------
  pCloud         pCloud Affiliate 20% of first     Lifetime plans pay well
                                  purchase         

  Filen          Filen Affiliate  30% recurring    Growing fast, high
                                                   conversion

  Internxt       Internxt         30% first year   European, GDPR-positive
                 Affiliate                         

  Backblaze B2   Partner program  Revenue share    Good for overflow
                                                   storage upsell
  ------------------------------------------------------------------------

**10 Competitive Positioning Summary**

  --------------------------------------------------------------------------------
  **Feature**             **CacheFlow   **MultCloud**   **Air         **Rclone**
                          v5**                          Explorer**    
  ----------------------- ------------- --------------- ------------- ------------
  Mobile PWA              ✅ Day 70     ❌ Major        ❌ Desktop    ❌
                                        complaint       only          

  VPS / SFTP storage      ✅ Day 58     ❌              ✅ Manual     ✅ CLI only
                                                        setup         

  Client-side OAuth       ✅ Tokens     ❌ Server       ✅            ✅
                          never leave   processes files               
                          browser                                     

  Office doc preview      ✅ Day 85     ❌              ❌            ❌
                          (Google                                     
                          viewer)                                     

  Full office editing     ✅ Post-pilot ❌              ❌            ❌
                          (Collabora)                                 

  AI conflict merge       ✅ Day 85--86 ❌              ❌            ❌

  Semantic search         ✅ Day 71--75 ❌              ❌            ❌

  Duplicate detection     ✅ Post-pilot ❌              ❌            ❌

  Affiliate storage panel ✅ Day 69     ❌              ❌            ❌

  Self-hosted option      ✅ OCI ARM    ❌              ✅ Desktop    ✅
                                                        app           

  Zero-retention AI       ✅ Day 80     ❌ Unknown      ❌            N/A
  --------------------------------------------------------------------------------

**Bottom Line**

The v4 plan is solid. The governing laws are excellent --- keep them
unchanged. The additions in v5 are three focused bets: VPS storage
(unique differentiator), PWA (fixes MultCloud\'s #1 complaint), and
document preview (positions CacheFlow as a storage OS, not just a sync
tool). None of these require restructuring what is already built. They
are additive, testable in isolation, and each one directly addresses a
documented competitor weakness or real user pain point.

May 21, 2026 pilot target is realistic with this scope. Collabora and
the desktop daemon are the two features worth rushing toward in Month 2
--- they are the ones that will drive word-of-mouth in the VPS and
self-hosted community.

CacheFlow v5.0 · CONFIDENTIAL · February 2026
