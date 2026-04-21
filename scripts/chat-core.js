/* Chat core — P catalog + full Trade Advisor state machine, extracted
   verbatim from index.html. Loaded by scripts/chat.js only on pages where
   chat isn't already initialized inline (i.e. not on index.html). */

const P = {
  dl10x: {
    model:'DL-10X', sub:'Level 3 / P-4 Cross Cut \u2014 Entry Mid-Sized Office Shredder', part:'DL10X (RS-2200A)',
    img:'images/products/dl-10x.jpg',
    specs:[['Cut Type','Level 3 / P-4 Cross Cut'],['Entry Width','10-3/4\u201d'],['Sheet Capacity','20\u201324 sheets'],['Shred Size','1/12\u201d \u00d7 5/8\u201d particles'],['Speed','22 FPM'],['Motor','2.2 Hp'],['Waste Bin','20 Gallons'],['Dimensions','30\u201d \u00d7 18\u201d \u00d7 16\u201d'],['Oil Required','No (Oil-Free)'],['Operation','Auto / Manual'],['Cabinet','Heavy Duty All Metal'],['Mobility','Swivel Casters'],['Energy','Standby Mode'],['Compliance','HIPAA \u2014 GSA Schedule']],
    features:['Extra-small 1/12\u201d \u00d7 5/8\u201d particle \u2014 added document security','All-Metal Chain Drive \u2014 no nylon or plastic internal gears','Oil-Free Operation \u2014 lower long-term cost, eco-friendly','Contactless Thermally Protected Motor \u2014 quiet, high performance','Load Indicator Display \u2014 prevents overfeeding','Automatic Reverse \u2014 prevents paper jams','Energy Saving Standby Mode','Safety Interlock Switches \u2014 full bin / open door shut-off','All-Metal Cabinet on Swivel Casters \u2014 easy mobility','HIPAA Compliant \u2014 GSA Schedule'],
    desc:'The DL-10X is ERGSN\u2019s entry-level mid-sized Level 3 / P-4 Cross Cut Paper Shredder. Built around the same Enhanced Cutter Design, Large Steel Gears, and All-Metal Chain Drive as the rest of the DL series, the DL-10X delivers extra-small 1/12\u201d \u00d7 5/8\u201d particles for added security in a compact 30\u201d \u00d7 18\u201d \u00d7 16\u201d footprint. Ideal for small to mid-sized offices that require higher security and long-term durability at a smaller form factor.'
  },
  dl12x: {
    model:'DL-12X', sub:'Level 3 / P-4 Cross Cut \u2014 Mid-Sized Office Shredder', part:'DL12X (RS-3300A)',
    img:'images/products/dl-12x.jpg',
    specs:[['Cut Type','Level 3 / P-4 Cross Cut'],['Entry Width','12-1/4\u201d'],['Sheet Capacity','Up to 26 sheets'],['Shred Size','5/64\u201d \u00d7 1\u20113/16\u201d'],['Speed','22 FPM'],['Motor','2.2 Hp'],['Waste Bin','30 Gallons'],['Dimensions','33\u201d \u00d7 20\u201d \u00d7 18\u201d'],['Oil Required','No (Oil-Free)'],['Operation','Auto / Manual'],['Cabinet','Heavy Duty All Metal'],['Mobility','Swivel Casters'],['Energy','Standby Mode'],['Compliance','HIPAA \u2014 GSA Schedule']],
    features:['All-Metal Chain Drive \u2014 no nylon or plastic internal gears','Oil-Free Operation \u2014 lower long-term cost, eco-friendly','Contactless Thermally Protected Motor \u2014 quiet, high performance','Load Indicator Display \u2014 prevents overfeeding','Automatic Reverse \u2014 prevents paper jams','Energy Saving Standby Mode','Safety Interlock Switches \u2014 full bin / open door shut-off','All-Metal Cabinet on Swivel Casters \u2014 easy mobility','Dual Modes: Automatic Start/Stop or Manual','HIPAA Compliant \u2014 GSA Schedule'],
    desc:'The DL-12X is a Level 3 / P-4 Cross Cut Paper Shredder built for long-term durability. With a shred particle of 5/64 \u00d7 1\u20113/16 inches and a true 12-1/4\u201d throat opening, it allows easy feeding in any direction. An Enhanced Cutter Design, Large Steel Gears, and All-Metal Chain Drive ensure zero nylon or plastic gears. Oil-free operation reduces maintenance costs. Suitable for mid-sized office environments.'
  },
  dl16x: {
    model:'DL-16X', sub:'Level 3 / P-4 Cross Cut \u2014 Large Office / Departmental', part:'DL16X (RS-3890A)',
    img:'images/products/dl-16x.jpg',
    specs:[['Cut Type','Level 3 / P-4 Cross Cut'],['Entry Width','16-1/4\u201d'],['Sheet Capacity','Up to 26 sheets'],['Shred Size','5/64\u201d \u00d7 1\u20113/16\u201d'],['Speed','22 FPM'],['Motor','2.5 Hp'],['Waste Bin','35 Gallons'],['Dimensions','35\u201d \u00d7 23\u201d \u00d7 20\u201d'],['Oil Required','No (Oil-Free)'],['Operation','Auto / Manual'],['Cabinet','Heavy Duty All Metal'],['Mobility','Swivel Casters'],['Energy','Standby Mode'],['Compliance','HIPAA \u2014 GSA Schedule']],
    features:['Widest entry (16-1/4\u201d) in DL cross-cut series \u2014 departmental use','All-Metal Chain Drive \u2014 no nylon or plastic internal gears','Oil-Free Operation \u2014 lower long-term cost, eco-friendly','Contactless Thermally Protected Motor \u2014 quiet, high performance','35-Gallon Waste Bin \u2014 less frequent emptying','Load Indicator Display \u2014 prevents overfeeding','Automatic Reverse \u2014 prevents paper jams','Energy Saving Standby Mode','Safety Interlock Switches \u2014 full bin / open door shut-off','HIPAA Compliant \u2014 GSA Schedule'],
    desc:'The DL-16X is a Level 3 / P-4 Cross Cut Paper Shredder designed for departmental high-volume shredding. With a wide 16-1/4\u201d entry and up to 26 sheets at 22 FPM, it handles busy office environments with ease. All-Metal Chain Drive with Large Steel Gears requires no oil. The 35-gallon waste bin and robust 2.5 Hp motor make it the workhorse of the DL series.'
  },
  dl10xd: {
    model:'DL-10XD', sub:'Level 3 / P-4 Cross Cut \u2014 High-Capacity 10\u201d Class', part:'DL10XD (RS-6602A)',
    img:'images/products/dl-10xd.jpg',
    specs:[['Cut Type','Level 3 / P-4 Cross Cut'],['Entry Width','10-1/4\u201d'],['Sheet Capacity','40\u201342 sheets'],['Shred Size','5/32\u201d \u00d7 1\u20113/16\u201d'],['Speed','22 FPM'],['Motor','2.5 Hp'],['Waste Bin','30 Gallons'],['Dimensions','38\u201d \u00d7 20\u201d \u00d7 18\u201d'],['Oil Required','No (Oil-Free)'],['Operation','Auto / Manual'],['Cabinet','Heavy Duty All Metal'],['Mobility','Swivel Casters'],['Energy','Standby Mode'],['Compliance','HIPAA \u2014 GSA Schedule']],
    features:['High-capacity 10\u201d class \u2014 up to 42 sheets per pass in a compact footprint','All-Metal Chain Drive \u2014 no nylon or plastic internal gears','Oil-Free Operation \u2014 lower long-term cost, eco-friendly','Contactless Thermally Protected Motor \u2014 quiet, high performance','Load Indicator Display \u2014 prevents overfeeding at high loads','Automatic Reverse \u2014 prevents jams under heavy use','Energy Saving Standby Mode','Safety Interlock Switches \u2014 full bin / open door shut-off','All-Metal Cabinet on Swivel Casters \u2014 easy mobility','HIPAA Compliant \u2014 GSA Schedule'],
    desc:'The DL-10XD is a high-volume Level 3 / P-4 Cross Cut Paper Shredder in ERGSN\u2019s 10\u201d class. Engineered for departments needing high throughput without the larger 12\u201d or 16\u201d footprint, it delivers up to 42 sheets per pass with a 2.5 Hp motor and 30-gallon waste bin. All-Metal Chain Drive and Large Steel Gears guarantee long-term reliability, while oil-free operation minimizes maintenance. Ideal for legal, healthcare, and financial offices with steady high-volume shred loads.'
  },
  dl12xd: {
    model:'DL-12XD', sub:'Level 3 / P-4 Cross Cut \u2014 High-Capacity 12\u201d Class', part:'DL12XD',
    img:'images/products/dl-12xd.jpg',
    specs:[['Cut Type','Level 3 / P-4 Cross Cut'],['Entry Width','12-1/4\u201d'],['Sheet Capacity','Up to 45 sheets'],['Shred Size','5/32\u201d \u00d7 1\u20113/16\u201d'],['Speed','22 FPM'],['Motor','2.3 Hp'],['Waste Bin','30 Gallons'],['Dimensions','33\u201d \u00d7 20\u201d \u00d7 18\u201d'],['Oil Required','No (Oil-Free)'],['Operation','Auto / Manual'],['Cabinet','Heavy Duty All Metal'],['Mobility','Swivel Casters'],['Energy','Standby Mode'],['Compliance','HIPAA \u2014 GSA Schedule']],
    features:['Highest sheet capacity in 12\u201d class \u2014 up to 45 sheets per pass','All-Metal Chain Drive \u2014 no nylon or plastic internal gears','Oil-Free Operation \u2014 lower long-term cost, eco-friendly','Contactless Thermally Protected Motor \u2014 quiet, high performance','Load Indicator Display \u2014 prevents overfeeding at high loads','Automatic Reverse \u2014 prevents jams under heavy use','Energy Saving Standby Mode','Safety Interlock Switches \u2014 full bin / open door shut-off','All-Metal Cabinet on Swivel Casters \u2014 easy mobility','HIPAA Compliant \u2014 GSA Schedule'],
    desc:'The DL-12XD offers the highest sheet capacity in the 12\u201d mid-size class. With 45 sheets per pass and a finer shred of 5/32 \u00d7 1\u20113/16 inches, it is built for departments requiring both throughput and higher document security. Enhanced Cutter Design, Large Steel Gears, and All-Metal Chain Drive deliver zero nylon or plastic gears \u2014 superior durability guaranteed.'
  },
  dl16xd: {
    model:'DL-16XD', sub:'Level 3 / P-4 Cross Cut \u2014 High Volume Flagship Industrial', part:'DL16XD (RS-8200A)',
    img:'images/products/dl-16xd.jpg',
    specs:[['Cut Type','Level 3 / P-4 Cross Cut'],['Entry Width','16\u201d'],['Sheet Capacity','Up to 90 sheets'],['Shred Size','5/32\u201d \u00d7 1-3/4\u201d'],['Speed','31 FPM'],['Motor','3.25 Hp'],['Waste Bin','45 Gallons'],['Dimensions','42\u201d \u00d7 34\u201d \u00d7 39\u201d'],['Voltage','115V, 30 Amp'],['Plug','NEMA L5-30P Locking'],['Cord','12/3 SO/SOWA, 10 ft'],['Oil Required','No (Oil-Free)'],['Cabinet','Heavy Duty All Metal'],['Mobility','Swivel Casters'],['Packaging','Individual Crate'],['Compliance','HIPAA \u2014 GSA Schedule']],
    features:['Flagship high-volume model \u2014 up to 90 sheets per pass at 31 FPM','3.25 Hp motor \u2014 highest-power DL Series shredder','45-Gallon waste bin \u2014 extended runtime between empties','All-Metal Chain Drive \u2014 no nylon or plastic internal gears','Oil-Free Operation \u2014 lower long-term cost, eco-friendly','115V / 30 Amp \u2014 U.S. electrical standards (NEMA L5-30P)','Individually crated for secure ocean freight','Safety Interlock Switches \u2014 full bin / open door shut-off','HIPAA Compliant \u2014 GSA Schedule'],
    desc:'The DL-16XD (RS-8200A) is ERGSN\'s flagship industrial shredder engineered for continuous heavy-duty operation. With up to 90 sheets per pass at 31 FPM and a 3.25 Hp motor, it delivers the highest throughput in the DL Series. Pre-wired for U.S. electrical standards at 115V / 30A with NEMA L5-30P locking plug and 12/3 cord, it installs directly in U.S. commercial and industrial facilities. A 45-gallon waste bin minimizes downtime, and the unit is individually crated for secure ocean freight.'
  },
  kt3dad: {
    model:'KT-3DAD', sub:'3D Advertising Production \u2014 Brand Commercials, Product Launches & DOOH', part:'KT3DAD (AD-PROD)',
    specs:[['Service Type','3D Advertising Production (end-to-end)'],['Use Cases','TV commercials, product launch films, DOOH, retail signage, social cutdowns'],['Scope','Concept \u2013 storyboard \u2013 live shoot / CGI \u2013 stereoscopic finishing'],['Duration','15s \u2013 3 min (master + social cuts)'],['Output Formats','Side-by-Side, Over-Under, MVC, anaglyph preview'],['Max Resolution','4K UHD (3840\u00d72160)'],['Color Depth','10-bit per channel, Rec.709 / Rec.2020'],['Frame Rate','24 / 25 / 29.97 / 30 / 50 / 60 fps'],['Delivery Assets','Master DCP/ProRes, social 16:9/9:16/1:1, still key art'],['Turnaround','3\u20136 weeks (concept to final)'],['Revisions','2 rounds of director review included']],
    features:['End-to-end 3D ad production \u2014 from concept brief to stereoscopic master','Brand-safe creative direction with 3D-native storyboarding','Live-action + CGI hybrid pipeline for product hero shots','Multi-format delivery: theatrical 3D, 3D TV, DOOH, social cutdowns','Proprietary ERGSN 2D-to-3D tooling for cost-efficient stereoscopic finishing','Depth grading tuned for each delivery surface (theater vs. DOOH vs. HMD)','Below-industry-average cost structure for 3D creative production','Ideal for brand launches, flagship retail windows, immersive campaigns'],
    desc:'KT-3DAD is ERGSN\'s end-to-end 3D advertising production service. We take a client brief through concept, 3D-native storyboarding, live shoot or CGI production, and stereoscopic finishing \u2014 delivering a theatrical-grade 3D commercial plus social cutdowns. The global advertising market is adopting 3D aggressively for flagship brand campaigns, product launches, and DOOH activations, but cost and technical complexity remain barriers. Leveraging ERGSN\'s proprietary 3D conversion engine, KT-3DAD keeps production costs competitive while delivering stereoscopic output tuned for each delivery surface \u2014 theater, 3D TV, digital out-of-home, and mobile.'
  },
  kt3dvid: {
    model:'KT-3DVID', sub:'2D \u2192 3D Video Conversion \u2014 Corporate, Event, Documentary & Broadcast', part:'KT3DVID (VIDEO-2D3D)',
    specs:[['Service Type','General 2D-to-3D Video Conversion'],['Use Cases','Corporate films, training video, event coverage, documentary, broadcast episodic'],['Input Formats','ProRes 422/4444, H.264, H.265, DPX, EXR'],['Output Formats','Side-by-Side, Over-Under, MVC, Frame-Packed'],['Max Resolution','4K UHD (3840\u00d72160)'],['Color Depth','8-bit / 10-bit per channel'],['Frame Rate','23.976 / 24 / 25 / 29.97 / 30 / 50 / 60 fps'],['Depth Grading','Per-scene, client-reviewed'],['Minimum Length','No minimum; priced by runtime'],['Turnaround','2\u20134 weeks (typical \u226490 min source)'],['Delivery','FTP / Aspera / physical drive']],
    features:['Convert existing 2D video libraries into stereoscopic 3D at scale','Proprietary ERGSN 2D-to-3D conversion engine \u2014 refined through continuous R&D','Market-competitive pricing vs. traditional post-production vendors','Device-tuned output: 3D TVs, HMDs, tablets, glasses-free displays, notebooks','Per-scene depth grading with client review cycle included','Scales from single event clips to full broadcast series runs','Fast turnaround \u2014 2 to 4 weeks for typical duration','Ideal for corporate, training, event, documentary, and episodic broadcast'],
    desc:'KT-3DVID converts general 2D video \u2014 corporate films, training content, event coverage, documentary, broadcast episodic \u2014 into stereoscopic 3D. The global 3D content gap extends beyond theatrical film: broadcasters, enterprises, and event producers need 3D output for 3D TVs, HMDs, tablets, and glasses-free displays, but traditional conversion workflows are cost-prohibitive. Powered by ERGSN\'s proprietary conversion engine, KT-3DVID delivers device-optimised stereoscopic output at market-competitive pricing \u2014 unlocking existing 2D video libraries for 3D distribution across corporate, broadcast, and event channels.'
  },
  rosettaplus: {
    model:'ROSETTA PLUS', sub:'Health Functional Food \u2014 Mental Wellness & Cellular Renewal Formula', part:'ROSETTAPLUS (HFF-RST+)',
    img:'images/products/rosseta-plus.jpg',
    specs:[['Category','Health Functional Food (HFF)'],['Target Function','Improvement of depression, psychosis, and panic disorder (representative function)'],['Certifications','HACCP &middot; Health Functional Food assured by KFDA'],['Production Capacity','Large-scale &mdash; 1,000+ units / month'],['Active Export Markets','Mexico, Yemen, India'],['Form','Glycosaminoglycan emulsion solution (proto-molecular multimolecular bonding)'],['Process','Microbial fermentation \u2014 secondary metabolite extraction'],['Core Raw Materials','3 functional polymolecules (see Features)'],['Origin','Republic of Korea'],['Packaging','Export-ready, HACCP-controlled lot batching'],['Lead Time','4\u20136 weeks (volume-dependent)']],
    features:['Representative function: improvement of depression, psychosis, and panic disorder','HACCP-certified production line; Health Functional Food assured by KFDA','Large-scale capacity: 1,000+ units per month, ready to scale','Active export operations to Mexico, Yemen, and India','Three secondary metabolites extracted via microbial fermentation','Multimolecular bonding of proto-molecular forms (glycosaminoglycan emulsion solution)','Continuous molecular subdivision after intake \u2014 maximised absorption rate','Core Raw Material 1: Restored natural cholecalciferol mitochondrial function, increased endocannabinoid receptors, macrophage activation factor production (positive electron carrier)','Core Raw Material 2: Per-mucoda protein \u2014 anti-inflammatory and anti-cancer functions (negative former)','Core Raw Material 3: Unsaturated lecithin envelope frame \u2014 extreme neurotransmitter delivery'],
    desc:'Rosetta Plus is the flagship K-Bio Health Functional Food in the ERGSN network \u2014 produced under HACCP certification and assured as a Health Functional Food by the Korean Food &amp; Drug Administration (KFDA). Its representative function is improvement of depression, psychosis, and panic disorder. Production runs at large-scale capacity (1,000+ units / month) with active export operations underway to Mexico, Yemen, and India. The Rosetta scientific principle is built on extraction of three secondary metabolites through microbial fermentation, multimolecular bonding of proto-molecular forms (a glycosaminoglycan emulsion solution), and continuous molecular subdivision after intake \u2014 maximising in-body absorption. The proprietary formulation combines three core raw materials: (1) a positive-electron carrier restoring natural cholecalciferol mitochondrial function, increasing endocannabinoid receptors, and producing macrophage activation factors; (2) a per-mucoda protein with anti-inflammatory and anti-cancer functions; and (3) an unsaturated lecithin envelope frame that delivers extreme neurotransmitters. ERGSN handles export documentation, HACCP-controlled lot batching, and overseas buyer onboarding.'
  },
  kt3dcine: {
    model:'KT-3DCINE', sub:'Legacy 2D Film \u2192 3D Remaster \u2014 Theatrical & OTT Re-Release', part:'KT3DCINE (CINEMA-REMASTER)',
    specs:[['Service Type','Feature-Length 2D-to-3D Film Remaster'],['Use Cases','Theatrical 3D re-release, OTT/streaming, catalog monetisation'],['Input Formats','DPX, EXR, ProRes 4444 XQ, DCP source'],['Output Formats','Stereo DCP, MVC, Side-by-Side, Frame-Packed'],['Max Resolution','4K DCP / UHD (3840\u00d72160)'],['Color Depth','12-bit DPX, 10-bit ProRes'],['Frame Rate','23.976 / 24 / 48 fps'],['Depth Grading','Per-shot, director / DoP reviewed'],['QC','Full-reel stereoscopic review before final master'],['Turnaround','8\u201316 weeks (feature-length)'],['Delivery','DCP, master files via Aspera / secure drive']],
    features:['Remaster existing 2D feature films into theatrical-grade stereoscopic 3D','Per-shot depth grading with director / DoP review cycles','Proprietary ERGSN 2D-to-3D engine \u2014 developed through continuous R&D','Addresses strong U.S. market preference for converting standard films to 3D','Unlock catalog value \u2014 convert back-catalog titles for theatrical re-release or OTT','Below-industry-average cost for feature-length conversion','Stereo DCP delivery for theatrical 3D projection','Suitable for studios, OTT platforms, and rights-holders with back catalogs'],
    desc:'KT-3DCINE is ERGSN\'s flagship 2D-to-3D feature film remastering service. The U.S. film market continues to release 3D titles steadily, with a strong emphasis on converting standard films into 3D rather than producing original 3D content \u2014 but conversion costs remain more than 3\u00d7 that of regular 2D production, a significant barrier to broader adoption. Using ERGSN\'s proprietary conversion technology refined through continuous R&D, KT-3DCINE delivers theatrical-grade stereoscopic remasters at market-competitive pricing. Studios and rights-holders can unlock back-catalog 2D titles for theatrical 3D re-release, OTT streaming, and international distribution with per-shot depth grading and stereo DCP delivery.'
  },
  keoa: {
    model:'KE-Option A', sub:'HYGEN Generator \u2014 Compact Starter Set (5 generators \u00b7 1 set)', part:'KEOA (HYGEN-1S5G)',
    img:'images/products/option-a.png',
    specs:[['Product','HYGEN Generator \u2014 single-shaft multi-generator set'],['Configuration','5 generators on 1 rotation shaft (1 set)'],['Per-Generator Output','150 \u2013 200 W'],['Set Output (continuous)','\u2265 1.0 kW/h'],['Drive Motor','DC 24V / 17A / 400W'],['Motor Speed','1 rpm (low-speed, high-torque)'],['Output Ports','10 ports'],['Unit Dimensions','80 \u00d7 30 \u00d7 30 cm'],['Unit Weight','\u2248 60 kg'],['Mounting','Single-shaft parallel array; generator count adjustable'],['Target Use','Light commercial / residential backup / micro-load']],
    features:['Korean HYGEN one-shaft architecture \u2014 multiple generators driven by a single low-rpm motor','5 generators per set; each generator delivers 150 \u2013 200 W','Compact single-unit footprint (80 \u00d7 30 \u00d7 30 cm, \u2248 60 kg)','Low-rpm (1 rpm) drive motor for reduced mechanical wear and quiet operation','Modular \u2014 generator count on the shaft can be adjusted to match site load','DC 24V motor input (17A / 400W) \u2014 compatible with solar / ESS DC buses','10 output ports per unit for parallel distribution','Entry tier \u2014 ideal for first-time HYGEN adopters and pilot deployments'],
    desc:'KE-Option A is the entry configuration of the HYGEN Generator family. A single DC 24V / 400W motor rotates one shaft at 1 rpm, driving 5 generators in parallel (150 \u2013 200 W each) for continuous set output of \u2265 1.0 kW/h. The unit measures 80 \u00d7 30 \u00d7 30 cm at \u2248 60 kg with 10 output ports. HYGEN\'s core advantage is the shared-shaft architecture: a single low-speed motor powers multiple generators at once, and the generator count is adjustable to match the site load profile. Option A targets pilot deployments, light commercial premises, residential backup, and off-grid micro-loads where a compact single-set footprint is required.'
  },
  keob: {
    model:'KE-Option B', sub:'HYGEN Generator \u2014 Standard Single Set (6 generators \u00b7 1 set)', part:'KEOB (HYGEN-1S6G)',
    img:'images/products/option-b.png',
    specs:[['Product','HYGEN Generator \u2014 single-shaft multi-generator set'],['Configuration','6 generators on 1 rotation shaft (1 set)'],['Per-Generator Output','150 \u2013 200 W'],['Set Output (continuous)','\u2248 1.2 kW/h'],['Drive Motor','DC 24V / 17A / 400W'],['Motor Speed','1 rpm (low-speed, high-torque)'],['Output Ports','10 ports'],['Unit Dimensions','80 \u00d7 30 \u00d7 30 cm'],['Unit Weight','\u2248 60 kg'],['Mounting','Single-shaft parallel array; generator count adjustable'],['Target Use','Standard commercial, small-business, workshop micro-grid']],
    features:['Standard HYGEN single-set configuration \u2014 6 generators on one rotation shaft','Each generator delivers 150 \u2013 200 W; set output \u2248 1.2 kW/h continuous','Matches the same compact unit footprint (80 \u00d7 30 \u00d7 30 cm, \u2248 60 kg) as Option A','Low-rpm (1 rpm) drive motor \u2014 extended service life, quiet operation','10 output ports per unit for parallel distribution','Adjustable generator count on the shared shaft for site-specific tuning','Direct DC 24V integration with solar / ESS DC architectures','Best-fit baseline for small-business and workshop micro-grid loads'],
    desc:'KE-Option B is the standard single-set HYGEN Generator configuration. The same 80 \u00d7 30 \u00d7 30 cm / \u2248 60 kg chassis as Option A is populated with 6 generators on the shared shaft, driven by the identical DC 24V / 400W motor at 1 rpm. Set output rises to \u2248 1.2 kW/h continuous, with 10 output ports per unit. Option B is the recommended baseline when buyers want the full single-set load band without stepping up to a multi-set combo \u2014 appropriate for standard commercial premises, workshops, and small-business micro-grid tie-ins.'
  },
  keoc: {
    model:'KE-Option C', sub:'HYGEN Generator \u2014 Dual-Set Combo (12 generators \u00b7 2 sets)', part:'KEOC (HYGEN-2S12G)',
    img:'images/products/option-c.png',
    specs:[['Product','HYGEN Generator \u2014 dual-set multi-generator array'],['Configuration','2 parallel sets \u00b7 12 generators total (6 per set)'],['Per-Generator Output','150 \u2013 200 W'],['Total Output (continuous)','\u2248 2.4 kW/h'],['Drive Motor','2 \u00d7 DC 24V / 17A / 400W'],['Motor Speed','1 rpm per shaft'],['Output Ports','20 ports (10 per set)'],['Array Dimensions','2 \u00d7 (80 \u00d7 30 \u00d7 30 cm)'],['Array Weight','\u2248 120 kg'],['Mounting','Side-by-side parallel sets; generator count per set adjustable'],['Target Use','Sustained commercial load, micro-grid, small ESS tie-in']],
    features:['Dual HYGEN set combo \u2014 two standard sets wired in parallel','12 generators total (6 per set) delivering \u2248 2.4 kW/h continuous','Same per-unit chassis (80 \u00d7 30 \u00d7 30 cm) doubled into a compact dual rack','Two independent DC 24V / 400W drive motors at 1 rpm \u2014 redundant drive path','20 total output ports for distributed load across multiple feeders','Each set\u2019s generator count is independently adjustable to site profile','Directly compatible with solar + ESS hybrids on the DC bus','Suited to sustained commercial loads and small micro-grid deployments'],
    desc:'KE-Option C packages two standard HYGEN sets (Option B units) side-by-side to deliver a continuous \u2248 2.4 kW/h at the busbar. Each set retains its own DC 24V / 400W motor and independent 1-rpm shaft with 6 generators \u2014 a redundant drive architecture that keeps at least half the array online during service. Combined port count rises to 20, and the per-set generator count can be tuned independently to match asymmetric load patterns. Option C is sized for sustained commercial load, small micro-grid tie-ins, and early-stage ESS-coupled deployments.'
  },
  keod: {
    model:'KE-Option D', sub:'HYGEN Generator \u2014 Triple-Set Flagship (18 generators \u00b7 3 sets)', part:'KEOD (HYGEN-3S18G)',
    img:'images/products/option-d.png',
    specs:[['Product','HYGEN Generator \u2014 triple-set multi-generator array (flagship)'],['Configuration','3 parallel sets \u00b7 18 generators total (6 per set)'],['Per-Generator Output','150 \u2013 200 W'],['Total Output (continuous)','\u2248 3.6 kW/h'],['Drive Motor','3 \u00d7 DC 24V / 17A / 400W'],['Motor Speed','1 rpm per shaft'],['Output Ports','30 ports (10 per set)'],['Array Dimensions','3 \u00d7 (80 \u00d7 30 \u00d7 30 cm)'],['Array Weight','\u2248 180 kg'],['Mounting','Triple parallel rack; each set independently serviceable'],['Target Use','Distributed generation, off-grid campus, ESS-tied facility']],
    features:['Flagship triple-set HYGEN array \u2014 three standard sets in a parallel rack','18 generators total (6 per set) for continuous \u2248 3.6 kW/h output','Three independent DC 24V / 400W motors at 1 rpm \u2014 full N+1 drive redundancy','30 total output ports across three feeders for zoned distribution','Each set\u2019s generator count is independently tunable to load demand','Optimised for ESS coupling, off-grid campus sites, and distributed generation','Same compact per-unit chassis (80 \u00d7 30 \u00d7 30 cm) \u2014 linear scaling of footprint','Highest continuous output in the HYGEN family within a single delivered array'],
    desc:'KE-Option D is the flagship HYGEN configuration \u2014 three standard sets racked in parallel to deliver a continuous \u2248 3.6 kW/h. Each set retains its own DC 24V / 400W drive motor, independent 1-rpm shaft, and 6 on-shaft generators, giving the array full N+1 drive redundancy and 30 distributed output ports. Each set\u2019s generator count remains independently adjustable, so the array can be tuned asymmetrically for facility zones. Option D is sized for distributed generation on commercial and light-industrial campuses, off-grid facility backup, and ESS-tied deployments where continuous multi-kilowatt output is required in a compact, serviceable footprint.'
  }
};

/* ═══ ④ CHATBOT ═════════════════════════════ */
/* ═══ HYBRID CHATBOT — Level 2 + Level 3 Ready ═════════ */
const CLAUDE_API_ENDPOINT = null;

// ── Context memory + user profile ──
let chatContext = { lastModel: null, history: [], topics: [], turnCount: 0, quotePrompted: false, awaitingReturn: null, currentStep: null, navStack: [] };
let userProfile = { sector: null, size: null, needs: [] };
function ctxPush(role, text) {
  chatContext.history.push({ role, text });
  if (chatContext.history.length > 10) chatContext.history.shift();
  if (role === 'user') chatContext.turnCount++;
}
function ctxTopic(t) { if (!chatContext.topics.includes(t)) { chatContext.topics.push(t); if (chatContext.topics.length > 8) chatContext.topics.shift(); } }

// ── User profile inference ──
function inferProfile(text) {
  const t = text.toLowerCase();
  if (/hospital|medical|health|clinic|hipaa|pharma|patient/.test(t)) userProfile.sector = 'healthcare';
  else if (/government|federal|gsa|military|defense|agency|dod/.test(t)) userProfile.sector = 'government';
  else if (/law|legal|attorney|firm/.test(t)) userProfile.sector = 'legal';
  else if (/bank|financ|insurance/.test(t)) userProfile.sector = 'financial';
  else if (/school|university|education|campus/.test(t)) userProfile.sector = 'education';
  const sizeMatch = t.match(/(\d+)\s*(people|person|employee|staff|worker)/);
  if (sizeMatch) userProfile.size = parseInt(sizeMatch[1]);
  if (/hipaa/.test(t) && !userProfile.needs.includes('hipaa')) userProfile.needs.push('hipaa');
  if (/gsa|government/.test(t) && !userProfile.needs.includes('gsa')) userProfile.needs.push('gsa');
  if (/quiet|silent|noise/.test(t) && !userProfile.needs.includes('quiet')) userProfile.needs.push('quiet');
  if (/compact|small|space/.test(t) && !userProfile.needs.includes('compact')) userProfile.needs.push('compact');
  if (/heavy|high.?volume|industrial|large/.test(t) && !userProfile.needs.includes('heavy')) userProfile.needs.push('heavy');
}
function profileEnrich(text) {
  let extra = '';
  if (userProfile.sector === 'healthcare' && !/hipaa/i.test(text)) extra += '\n\n✓ All DL models are HIPAA compliant for healthcare use.';
  if (userProfile.sector === 'government' && !/gsa/i.test(text)) extra += '\n✓ Listed on GSA Schedule for federal procurement.';
  return extra;
}

// ── Fuzzy matching (Levenshtein distance) ──
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n; if (n === 0) return m;
  const d = Array.from({length:m+1}, (_,i) => [i]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    d[i][j] = Math.min(d[i-1][j]+1, d[i][j-1]+1, d[i-1][j-1] + (a[i-1]===b[j-1]?0:1));
  return d[m][n];
}
const FUZZY_DICT = ['hipaa','shredder','baltimore','singapore','rotterdam','hamburg','dubai','istanbul','jakarta','warranty','voltage','incoterms','compliance','capacity','maintenance','industrial','security'];
function fuzzyCorrect(text) {
  return text.toLowerCase().replace(/\b\w{4,}\b/g, word => {
    for (const correct of FUZZY_DICT) {
      if (levenshtein(word, correct) <= 2 && word !== correct) return correct;
    }
    return word;
  });
}

// ── Conversational patterns ──
const CONV_PATTERNS = [
  { re: /^(yes|yeah|yep|sure|ok|okay|yea|right)$/i, handler: 'handleYes' },
  { re: /^(no|nope|nah|not really|no thanks)$/i, handler: 'handleNo' },
  { re: /^(tell me more|more info|more details|elaborate|explain|go on)$/i, handler: 'handleMore' },
  { re: /^(what else|anything else|other|others)$/i, handler: 'handleWhatElse' },
  { re: /^(thanks|thank you|thx|cheers)$/i, handler: 'handleThanks' }
];
function handleYes() {
  if (chatContext.lastModel) {
    chatBotMsg(`Great! Would you like to set up a quote for the ${P[chatContext.lastModel].model}?`, () => {
      chatOpts([
        { label: cl('quote') + ' →', action: () => { chatState.model = chatContext.lastModel; chatAskQualification(); }},
        { label: cl('specs'), action: () => { chatContext.awaitingReturn = { type:'browse', model: chatContext.lastModel }; toggleChat(); openModal(chatContext.lastModel); }},
      ]);
    });
  } else { chatBotMsg(cl('greet')); }
}
function handleNo() {
  chatBotMsg("No problem! Is there anything else I can help with?", () => {
    chatOpts([
      { label: 'Product Specs', action: () => handleQuoteChat() },
      { label: 'Shipping & Trade', action: () => respondToIntent(KB.find(k=>k.intent==='shipping'),'') },
      { label: cl('human'), action: () => showHumanContact() }
    ]);
  });
}
function handleMore() {
  if (chatContext.lastModel) {
    const p = P[chatContext.lastModel];
    chatBotMsg(`More about ${p.model}:\n\n${p.desc}${cl('techNote')}`, () => {
      chatOpts([
        { label: cl('specs'), action: () => { chatContext.awaitingReturn = { type:'browse', model: chatContext.lastModel }; toggleChat(); openModal(chatContext.lastModel); }},
        { label: 'Key Features', action: () => { chatBotMsg(p.features.slice(0,5).map(f=>'• '+f).join('\n')); }},
        { label: cl('quote') + ' →', action: () => { chatState.model = chatContext.lastModel; chatAskQualification(); }},
      ]);
    });
  } else {
    chatBotMsg("What would you like to know more about?", () => {
      chatOpts([
        { label: 'Browse K-Security (DL Series)', action: () => chatStep('browse_models') },
        { label: 'Browse K-Tech 3D services', action: () => chatStep('browse_ktech') },
        { label: 'Browse K-Energy (HYGEN Generator)', action: () => chatStep('browse_kenergy') },
        { label: 'K-Bio · Rosetta Plus', action: () => chatStep('browse_kbio') },
        { label: 'Upcoming sectors (K-Beauty / Culture / Franchise / Smart Living)', action: () => chatStep('browse_sourcing') },
        { label: cl('quote') + ' →', action: () => chatStep('quote_direct') }
      ]);
    });
  }
}
function handleWhatElse() {
  const unvisited = KB.filter(k => k.resp && !chatContext.topics.includes(k.intent)).slice(0,4);
  if (unvisited.length) {
    chatBotMsg("Here are some topics we haven't covered:", () => {
      chatOpts(unvisited.map(k => ({
        label: k.intent.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()),
        action: () => respondToIntent(k, '')
      })));
    });
  } else { chatBotMsg("We've covered a lot! Ready to request a quote?", () => { chatOpts([{ label: cl('quote') + ' →', action: () => chatStep('start') }]); }); }
}
function handleThanks() {
  chatBotMsg("You're welcome! Feel free to ask anything else, or I can help set up a quote.", () => {
    chatOpts([{ label: cl('quote') + ' →', action: () => chatStep('start') }, { label: 'New Question', action: () => restartChat() }]);
  });
}

// ── Dynamic spec lookup from P object ──
function dynamicSpecLookup(text, modelId) {
  const id = modelId || findModelInText(text) || chatContext.lastModel;
  if (!id) return null;
  const p = P[id];
  const lower = text.toLowerCase();
  const sector = sectorOf(id);
  const shredderKeywords = {
    'entry width':['entry','width','throat','opening','feed'],
    'sheet capacity':['sheet','capacity','pages','how many'],
    'shred size':['shred','particle','cut size'],
    'speed':['speed','fpm','fast','per minute'],
    'motor':['motor','hp','horsepower','power'],
    'waste bin':['waste','bin','bag','gallon','gal','container','bucket'],
    'dimensions':['dimension','size','height','wide','deep','footprint'],
    'voltage':['volt','voltage','amp','electric','power','plug','nema'],
    'oil required':['oil','lubrication'],
    'compliance':['hipaa','compliance','certif'],
    'cut type':['cut type','security','level','p-4']
  };
  const ktechKeywords = {
    'service type':['service type','what service','what it is'],
    'use cases':['use case','use cases','what for','when to use'],
    'output formats':['output format','format','side-by-side','over-under','mvc','frame-packed','dcp'],
    'max resolution':['resolution','4k','uhd','hd'],
    'color depth':['color depth','bit depth','10-bit','12-bit','8-bit'],
    'frame rate':['frame rate','fps','24fps','60fps','23.976'],
    'turnaround':['turnaround','lead time','how long','how fast','weeks'],
    'input formats':['input format','source','prores','h.264','h.265','dpx','exr'],
    'delivery':['delivery','deliver','download','aspera','drive'],
    'depth grading':['depth grading','depth','review','grading','qc'],
    'revisions':['revision','rounds','review cycle']
  };
  const kbioKeywords = {
    'target function':['function','depression','psychosis','panic','mental','wellness','efficacy','claim'],
    'certifications':['certification','haccp','kfda','fda','license','compliance','certified'],
    'production capacity':['capacity','volume','units','production','scale','output'],
    'active export markets':['export','market','country','where','mexico','yemen','india'],
    'form':['form','liquid','emulsion','capsule','tablet','format'],
    'process':['process','how made','manufactur','fermentation','extract'],
    'core raw materials':['raw material','ingredient','cholecalciferol','glycosamin','lecithin','mucoda','what is in','composition'],
    'origin':['origin','country of origin','where from','made in'],
    'packaging':['packaging','pack','lot','batch'],
    'lead time':['lead time','turnaround','how long','when ready','delivery time']
  };
  const keywordMap = sector === 'k-tech' ? ktechKeywords : sector === 'k-bio' ? kbioKeywords : shredderKeywords;
  for (const [specKey, keywords] of Object.entries(keywordMap)) {
    if (keywords.some(kw => lower.includes(kw))) {
      const match = p.specs.find(([k]) => k.toLowerCase().includes(specKey.split(' ')[0]));
      if (match) {
        chatContext.lastModel = id;
        return { model: p.model, key: match[0], value: match[1] };
      }
    }
  }
  return null;
}

// ── Proactive quote suggestion ──
function maybePromptQuote() {
  if (chatContext.turnCount >= 3 && !chatContext.quotePrompted && chatContext.lastModel) {
    chatContext.quotePrompted = true;
    setTimeout(() => {
      const body = document.getElementById('chatBody');
      const div = document.createElement('div'); div.className = 'chat-options';
      div.style.cssText = 'border-top:1px solid var(--gold);padding-top:10px;margin-top:8px;';
      const hint = document.createElement('span');
      hint.style.cssText = 'font-size:11px;color:var(--gold);display:block;margin-bottom:6px;';
      hint.textContent = `💡 I have enough info to prepare a ${P[chatContext.lastModel].model} quote for you.`;
      div.appendChild(hint);
      const b = document.createElement('button'); b.className = 'chat-opt';
      b.textContent = cl('quote') + ' →';
      b.onclick = () => { div.remove(); chatState.model = chatContext.lastModel; chatAskQualification(); };
      div.appendChild(b);
      body.appendChild(div); body.scrollTop = body.scrollHeight;
    }, 600);
  }
}

// ── Multilingual bot phrases ──
// Hybrid policy: short UI labels are localized; the long technical answers
// (KB responses, model specs, Incoterms) stay in English for precision.
// `intro` is shown once per session as the opening bot message when the
// active language is not English — it explains the hybrid approach.
const CHAT_L = {
  en:{greet:"How can I help?",followup:"You might also want to know:",fallback:"I can help with:",human:"Talk to a Human",quote:"Set Up Quote",specs:"View Full Specs",techNote:"",intro:""},
  es:{greet:"¿Cómo puedo ayudarle?",followup:"También podría interesarle:",fallback:"Puedo ayudarle con:",human:"Hablar con una Persona",quote:"Solicitar Cotización",specs:"Ver Especificaciones",techNote:"\n\n(Detalles técnicos en inglés para precisión)",intro:"Respondo en español cuando es posible. Las especificaciones técnicas (certificaciones, Incoterms, dimensiones) se mantienen en inglés para garantizar la precisión."},
  ar:{greet:"كيف يمكنني مساعدتك؟",followup:"قد يهمك أيضاً:",fallback:"يمكنني المساعدة في:",human:"التحدث مع شخص",quote:"طلب عرض سعر",specs:"عرض المواصفات",techNote:"\n\n(التفاصيل التقنية بالإنجليزية للدقة)",intro:"أُجيبك بالعربية قدر الإمكان. المواصفات التقنية (الشهادات وشروط Incoterms والأبعاد) تبقى بالإنجليزية لضمان الدقة."},
  fr:{greet:"Comment puis-je vous aider ?",followup:"Vous pourriez aussi vouloir savoir :",fallback:"Je peux vous aider avec :",human:"Parler à un humain",quote:"Demander un Devis",specs:"Voir les Spécifications",techNote:"\n\n(Détails techniques en anglais pour plus de précision)",intro:"Je réponds en français quand c'est possible. Les spécifications techniques (certifications, Incoterms, dimensions) sont en anglais pour garantir l'exactitude."},
  ja:{greet:"どのようなご用件でしょうか？",followup:"こちらもご参考ください：",fallback:"以下のご質問にお答えできます：",human:"担当者に相談",quote:"見積もり依頼",specs:"詳細仕様を見る",techNote:"\n\n(技術詳細は正確性のため英語で記載)",intro:"可能な範囲で日本語でお答えします。技術仕様（認証、インコタームズ、寸法）は正確性のため英語表記となります。"},
  tr:{greet:"Size nasıl yardımcı olabilirim?",followup:"Şunları da öğrenmek isteyebilirsiniz:",fallback:"Şu konularda yardımcı olabilirim:",human:"Bir Kişiyle Konuşun",quote:"Teklif Talep Et",specs:"Teknik Özellikleri Gör",techNote:"\n\n(Teknik detaylar doğruluk için İngilizce)",intro:"Mümkün olduğunca Türkçe yanıt veriyorum. Teknik özellikler (sertifikalar, Incoterms, boyutlar) doğruluk için İngilizce verilir."},
  "zh-Hans":{greet:"请问有什么可以帮您？",followup:"您可能还想了解：",fallback:"我可以为您解答：",human:"与真人对话",quote:"获取报价",specs:"查看完整规格",techNote:"\n\n(技术细节以英文呈现，以确保准确性)",intro:"我会尽可能以中文回答。技术规格（认证、贸易术语、尺寸）以英文呈现，以确保准确性。"},
  "zh-Hant":{greet:"請問有什麼可以幫您？",followup:"您可能還想了解：",fallback:"我可以為您解答：",human:"與真人對話",quote:"取得報價",specs:"查看完整規格",techNote:"\n\n(技術細節以英文呈現，以確保準確性)",intro:"我會盡可能以中文回答。技術規格（認證、貿易條件、尺寸）以英文呈現，以確保準確性。"}
};
function cl(key) { const lang = document.documentElement.lang || 'en'; return (CHAT_L[lang] && CHAT_L[lang][key]) || CHAT_L.en[key] || ''; }

const SHREDDER_IDS = ['dl10x','dl12x','dl16x','dl10xd','dl12xd','dl16xd'];
const KTECH_IDS = ['kt3dad','kt3dvid','kt3dcine'];
const KBIO_IDS = ['rosettaplus'];
const KENERGY_IDS = ['keoa','keob','keoc','keod'];
const MODEL_IDS = [...SHREDDER_IDS, ...KTECH_IDS, ...KBIO_IDS, ...KENERGY_IDS];

function sectorOf(id) {
  if (SHREDDER_IDS.includes(id)) return 'k-security';
  if (KTECH_IDS.includes(id)) return 'k-tech';
  if (KBIO_IDS.includes(id)) return 'k-bio';
  if (KENERGY_IDS.includes(id)) return 'k-energy';
  return null;
}

function findModelInText(text) {
  const t = text.toLowerCase().replace(/[- ]/g,'');
  for (const id of MODEL_IDS) {
    if (t.includes(id) || t.includes(id.replace('dl','dl-'))) return id;
  }
  const aliases = {
    dl10x:'10x', dl12x:'12x', dl16x:/(^|[^d])16x([^d]|$)/,
    dl10xd:'10xd', dl12xd:'12xd', dl16xd:'16xd',
    kt3dad: /(kt3dad|3dad|3dadvert|3dcommerc|3dcm|3dad(s|vertis))/,
    kt3dcine: /(kt3dcine|3dcine|cinema|feature\s?film|remaster|theatrical)/,
    kt3dvid: /(kt3dvid|3dvid|3dvideo|2dto3d|2d→3d|stereoscop|3dconvert|3dconvers|stereoconv)/,
    rosettaplus: /(rosetta|rosettaplus|hff|healthfunctional|kfda|haccp|glycosaminoglycan|cholecalcif)/,
    keoa: /(keoa|keoptiona|ke-optiona|hygen1s5g|hygen-?a|optiona)/,
    keob: /(keob|keoptionb|ke-optionb|hygen1s6g|hygen-?b|optionb)/,
    keoc: /(keoc|keoptionc|ke-optionc|hygen2s12g|hygen-?c|optionc)/,
    keod: /(keod|keoptiond|ke-optiond|hygen3s18g|hygen-?d|optiond)/
  };
  for (const [id,pat] of Object.entries(aliases)) {
    if (typeof pat === 'string' ? t.includes(pat) : pat.test(t)) return id;
  }
  return null;
}

function fmtSpecs(id) {
  const p = P[id]; if (!p) return '';
  return p.specs.slice(0,8).map(([k,v]) => `• ${k}: ${v}`).join('\n');
}

function fmtCompare(a,b) {
  const pa=P[a], pb=P[b]; if(!pa||!pb) return null;
  const keys=[]; pa.specs.forEach(([k])=>{if(!keys.includes(k))keys.push(k)}); pb.specs.forEach(([k])=>{if(!keys.includes(k))keys.push(k)});
  const ma=Object.fromEntries(pa.specs), mb=Object.fromEntries(pb.specs);
  let t = `${pa.model} vs ${pb.model}:\n`;
  keys.slice(0,10).forEach(k => { t += `• ${k}: ${ma[k]||'—'} vs ${mb[k]||'—'}\n`; });
  return t;
}

const KB = [
  { intent:'greeting', kw:['hello','hi','hey','good morning','good afternoon','howdy'], resp:"Hello! I'm the ERGSN Trade Advisor. ERGSN is Korea's B2B trade gateway connecting verified Korean manufacturers to global buyers. Active catalog:\n\n• K-Security — DL Series industrial shredders (6 models, GSA Schedule, HIPAA · Level 3 / P-4)\n• K-Tech — 2D → 3D stereoscopic conversion (KT-3DAD advertising · KT-3DVID video · KT-3DCINE feature film)\n• K-Energy — HYGEN Generator (4 configurations: KE-Option A / B / C / D)\n• K-Bio — Rosetta Plus HFF (HACCP · KFDA, exporting to MX/YE/IN)\n\nSourcing in 2026: K-Beauty · K-Culture Goods · K-Franchise · K-Smart Living.\n\nAsk me about specs, MOQ, lead times, Incoterms, certifications, Partner Match, Spotlight concepts, Quote Calculator, RFQ Tracker — or anything else. How can I help?" },
  { intent:'thanks', kw:['thank','thanks','great','awesome','perfect','appreciate'], resp:"You're welcome! Feel free to ask anything else, or click below to request a quote." },
  { intent:'bye', kw:['bye','goodbye','see you','talk later'], resp:"Thank you for visiting ERGSN! Don't hesitate to reach out anytime. Have a great day!" },
  { intent:'price', kw:['price','cost','how much','pricing','budget','expensive','cheap','dollar','usd'], resp:"We provide competitive CIF pricing tailored to each order (quantity, destination, terms). Prices are quoted per inquiry to ensure accuracy.\n\nWould you like me to set up a quote request?" },
  { intent:'hipaa', kw:['hipaa','healthcare','medical','hospital','patient','health','phi','protected'], followUp:['security','oil','recommend'], resp:"All DL Series models are HIPAA compliant. They produce cross-cut particles at Level 3 / P-4 security, meeting HIPAA document destruction requirements for Protected Health Information (PHI).\n\nFor healthcare facilities, we recommend:\n�� DL-12X (26 sheets) — standard clinics\n• DL-12XD (45 sheets) — high-volume hospitals" },
  { intent:'gsa', kw:['gsa','government','federal','schedule','procurement','sam.gov','contract'], followUp:['hipaa','shipping','payment'], resp:"ERGSN shredders are listed on the U.S. GSA Schedule, making them eligible for direct federal procurement. This means:\n• Streamlined purchasing for government agencies\n• Pre-negotiated pricing\n• Simplified acquisition process\n\nContact us with your agency details for GSA-specific pricing." },
  { intent:'security', kw:['security','p-4','level 3','din','66399','classification','particle','shred size'], followUp:['hipaa','chain','compare'], resp:"All DL Series models meet DIN 66399 Level 3 / P-4 security:\n�� Standard models (X): 5/64\" × 1-3/16\" particles\n• High-capacity models (XD): 5/32\" × 1-3/16\" particles\n• DL-10X special: 1/12\" × 5/8\" (extra-fine)\n• DL-16XD: 5/32\" × 1-3/4\" particles\n\nP-4 is the most widely required level for commercial and government use." },
  { intent:'oil', kw:['oil','oil-free','lubrication','lubricant','maintenance cost'], followUp:['chain','warranty','price'], resp:"All DL Series shredders are 100% oil-free. This means:\n• No shredder oil purchases (saves ~$200/year per machine)\n• No oil residue on shredded particles\n• Cleaner operation — ideal for healthcare/food-adjacent offices\n• Reduced fire risk from oil-soaked paper waste\n• Lower total cost of ownership" },
  { intent:'chain', kw:['chain','drive','metal','gear','nylon','plastic','durability','construction','quality'], followUp:['oil','warranty','competitor'], resp:"Every ERGSN shredder uses an all-metal chain drive with large steel gears — zero nylon or plastic internal components.\n\nWhy this matters:\n• Nylon gears wear out in 1-2 years under heavy use\n• Metal gears last 10+ years\n• Chain drive eliminates gear-tooth breakage\n• Result: machines built for years of daily operation, not months" },
  { intent:'shipping', kw:['shipping','delivery','lead time','how long','when','weeks','transit','freight'], followUp:['incoterms','payment','quote'], resp:"Standard lead time: 4-6 weeks from advance payment.\n• Manufacturing: 2-3 weeks\n• Ocean freight (Seoul → your port): 2-4 weeks\n• Individual crating for secure transport\n\nWe ship CIF to any major port worldwide. The DL-16XD is individually crated for extra protection during ocean freight." },
  { intent:'incoterms', kw:['incoterm','cif','fob','exw','cfr','fca','dap','ddp','trade term'], followUp:['shipping','payment','quote'], resp:"We support all major Incoterms 2020:\n• CIF (most popular) — we handle freight + insurance to your port\n• FOB — you arrange freight from Korean port\n• EXW — pickup from our Seoul facility\n• CFR, FCA, DAP, DDP — also available\n\nCIF is recommended for first-time buyers — we handle all logistics." },
  { intent:'payment', kw:['payment','t/t','wire','transfer','deposit','advance','terms','pay'], resp:"Payment terms:\n• 50% advance via T/T (wire transfer) upon order confirmation\n• 50% balance before shipment\n• Bank: provided on Proforma Invoice\n\nWe issue a formal Proforma Invoice after receiving your RFQ." },
  { intent:'voltage', kw:['voltage','volt','amp','electric','power','plug','nema','wire','220v','110v','115v'], followUp:['custom','spec','quote'], resp:"Standard voltage: 115V / 60Hz (U.S. standard)\n• DL-10X to DL-12XD: standard 15A outlet\n• DL-16XD: 115V / 30A with NEMA L5-30P locking plug, 12/3 SO/SOWA cord (10ft)\n\nFor 220V/50Hz markets, custom voltage configurations may be available — please specify in your quote request." },
  { intent:'warranty', kw:['warranty','guarantee','repair','defect','broken','issue','problem'], resp:"ERGSN provides manufacturer warranty on all DL Series models. Warranty terms are specified on the Proforma Invoice per order.\n\nAll-metal chain drive construction means significantly fewer mechanical failures compared to plastic-gear alternatives. Our machines are designed for 10+ years of reliable operation." },
  { intent:'company', kw:['ergsn','company','about','who','history','founded','korea','seoul','manufacturer','identity','platform','gateway','mission'], followUp:['platform','sectors','verification'], resp:"ERGSN CO., LTD. — Korea's Trusted Trade Gateway\n• Founded: 2013, Seoul, Korea (13+ years of trade history)\n• Identity: Trade PLATFORM (not a manufacturer) — we implant Korean hi-tech and cultural trends into global business\n• Flagship track record: Long-term supply partner of Capital Shredder Corp. (Rockville, MD). DL Series shredders are GSA Schedule listed and U.S. defense procured\n• Sectors: K-Security (active) · K-Tech (active) · K-Bio (active) · K-Beauty · K-Culture Goods · K-Franchise · K-Smart Living · K-Energy (joining 2026)\n• Certifications: HIPAA · GSA · DIN 66399\n• Terms: CIF worldwide · T/T payment" },
  { intent:'platform', kw:['what do you do','what is ergsn','platform','redefine','role','mission','position','not a manufacturer','trade platform'], followUp:['sectors','verification','ai_match'], resp:"ERGSN is a TRADE PLATFORM — not a manufacturer. Our role is to implant Korea's high-technology and cultural trends directly into global business operations.\n\nHow it works:\n1. We identify top Korean producers across hi-tech and lifestyle sectors\n2. We personally vet, audit, and partner with them over years\n3. We deliver their best products to global procurement teams — with Korean engineering rigor and export compliance built-in\n\nOur flagship DL Series shredders (K-Security) prove the model — 13+ years of trade, GSA Schedule, U.S. defense procured. Now scaling the same verification standard to K-Tech, K-Bio, K-Beauty, K-Culture Goods, K-Franchise, K-Smart Living, K-Energy, and K-Tourism Assets." },
  { intent:'sectors', kw:['sectors','sector','category','categories','k-security','security','k-tech','ktech','k-bio','kbio','k-beauty','kbeauty','k-culture','culture goods','k-franchise','franchise','k-smart living','smart living','k-energy','future energy','energy','what products','product lines','coming soon','2026'], followUp:['platform','verification','ai_match'], resp:"ERGSN multi-sector catalog:\n\n🟢 K-Security (ACTIVE) — DL Series shredders (6 models). Level 3/P-4, all-metal, GSA Schedule, HIPAA compliant.\n\n🟢 K-Tech (ACTIVE) — 2D → 3D stereoscopic conversion: advertising, video, theatrical-grade film remaster.\n\n🟢 K-Energy (ACTIVE) — HYGEN Generator. One DC 24V / 400W motor drives multiple generators on a shared shaft. Four configurations (KE-Option A / B / C / D) from 1.0 kW/h to 3.6 kW/h continuous.\n\n🟢 K-Bio (ACTIVE) — Rosetta Plus Health Functional Food (HACCP · KFDA). Already exporting to MX, YE, IN.\n\n⏳ K-Beauty (sourcing) — Premium skincare, cosmetics, beauty devices from audited Korean brands.\n\n⏳ K-Culture Goods (sourcing) — Licensed K-pop/K-drama merchandise, traditional crafts, designer fashion.\n\n⏳ K-Franchise (sourcing) — Verified Korean F&B, café, retail and service franchise concepts with master-franchise opportunities.\n\n⏳ K-Smart Living (sourcing) — Connected appliances, wellness & beauty-tech devices, premium K-lifestyle goods.\n\n⏳ K-Tourism Assets (sourcing) — MICE event infrastructure, medical-tourism concierge, hospitality tech, and destination-marketing partnerships with Korean DMOs.\n\nAll Sourcing sectors apply the same partner-verification standard that built our DL Series track record." },
  { intent:'verification', kw:['verification','verify','vet','audit','partner','qualification','process','how do you choose','standard','how verify'], followUp:['platform','sectors','company'], resp:"ERGSN's 4-step partner verification process (before any Korean producer joins our network):\n\n1. Discovery — identify candidate manufacturers through Korean industrial networks\n2. Engineering Audit — inspect production, quality systems, materials (e.g. all-metal chain drive standard)\n3. Compliance & Export Review — verify certifications, export history, trade documentation\n4. Long-term Partnership — multi-year collaboration and performance tracking before full catalog listing\n\nThis is the same rigor that shaped our DL Series — and it now extends to K-Tech, K-Bio, K-Beauty, K-Culture Goods, K-Franchise, K-Smart Living, K-Energy, and K-Tourism Assets." },
  { intent:'ai_match', kw:['ai match','partner match','match making','matchmaking','ai curation','recommendation tool','who is right','suggest supplier','fit for me'], followUp:['sectors','quote','calculator'], resp:"AI Partner Match-making is ERGSN's curation tool. Tell it:\n• Your country\n• Your primary industry (government, finance, healthcare, tech, manufacturing, energy, retail, etc.)\n• (Optional) annual procurement volume\n\nIt returns a ranked Top 3 of ERGSN portfolio items with a fit score — pulling from active DL Series, K-Tech, K-Bio products and upcoming K-Beauty / K-Culture Goods / K-Franchise / K-Smart Living / K-Energy items.\n\nClick 'Request Quote for These' and your selections auto-fill into the RFQ form, which sends to ERGSN via email + Telegram." },
  { intent:'calculator', kw:['calculator','estimate','quote calculator','instant quote','price estimate','calc'], followUp:['quote','incoterms','shipping'], resp:"The Quote Calculator gives you an instant CIF/FOB estimate. Pick model, quantity, destination — it shows indicative pricing in your local currency (with live FX).\n\nThis is an estimate for planning. For a binding quote, use 'Request a Quote' (RFQ form) — we'll issue a formal Proforma Invoice." },
  { intent:'route_map', kw:['map','route','shipping route','trade route','lanes','ports','how do you ship','logistics map'], followUp:['shipping','incoterms','payment'], resp:"Our Trade Route Map visualizes shipping lanes from Seoul/Busan to 14 major ports worldwide — Baltimore, Los Angeles, Long Beach, Hamburg, Rotterdam, Jebel Ali, Singapore, Tokyo, Sydney and more.\n\nWe ship CIF to any major port. Lead time: 4–6 weeks after advance payment (2–3 weeks production + 2–4 weeks ocean freight)." },
  { intent:'tools', kw:['tools','what tools','website features','interactive','services on site','dashboard'], followUp:['ai_match','spotlight','trade_tools','calculator','route_map'], resp:"ERGSN decision-support tools:\n• AI Partner Match — country + industry → Top-3 curated portfolio\n• Spotlight — vote on pre-launch concepts; submit formal inquiries\n• Quote Calculator — instant CIF/FOB estimate in your currency\n• Landed Cost Simulator — includes duty + VAT per country\n• Compliance Checker — required certifications by market\n• Book a Live Demo — 30-min Zoom via Calendly\n• Trade Route Map — 14 global shipping lanes from Korea\n• RFQ Tracker — track submitted RFQ status by ID\n• Q&A Wall — public community questions with answers" },
  { intent:'trade_tools', kw:['trade tools','landed cost','duties','tariff','vat','compliance checker','required certs','certifications checklist','book demo','demo booking','zoom','meeting','appointment'], followUp:['calculator','quote','verification'], resp:"Trade Tools section has three utilities:\n\n1. 🧾 Landed Cost Simulator — enter destination + FOB price + quantity. Returns CIF + import duty (country-specific) + VAT/GST + per-unit landed cost.\n\n2. ✅ Compliance Checker — pick country + industry. Returns the certification and documentation checklist for that market (HIPAA, CE, IEC, UL, KC, etc.)\n\n3. 📅 Book a Live Demo — pick a 30-min KST slot. Booking sent via email + Telegram to ERGSN trade team; confirmation within 1 business day." },
  { intent:'qa', kw:['q&a','qa','question wall','community','forum','ask question','post question','faq public'], followUp:['contact','tools','chat'], resp:"The Q&A Wall is ERGSN's public buyer community. Browse past buyer questions (MOQ, voltage, launch timing, certifications) with answers from our trade team. Post your own — we'll reply and publish it back to the wall. Great for SEO-friendly institutional knowledge." },
  { intent:'spotlight', kw:['spotlight','pre-launch','prelaunch','radar','concept','preview','upcoming product','market test','vote','poll','interest','what\'s next','early access','beta product','new product'], followUp:['ai_match','sectors','verification'], resp:"Spotlight is ERGSN's Pre-Launch Radar — concepts we're evaluating with verified Korean makers before formal launch.\n\nHow it works:\n• Browse concept cards tagged Concept / Prototype / Pilot\n• 👍 Click 'I'm Interested' — anonymous signal, boosts the concept's priority\n• 🗳️ Vote on the short preference poll on each card\n• 💬 Submit a quick inquiry (name + country + industry + est. volume + feedback)\n\nEvery interaction reaches our team via email + Telegram, helping us gauge global demand and shape which Korean products ERGSN brings to market next. Current concepts span K-Tech (Industrial IoT Sensors), K-Beauty (Smart Mirror), K-Culture Goods (licensed lifestyle goods) and K-Energy (Commercial ESS)." },
  { intent:'contact', kw:['contact','email','phone','telegram','reach','call','address'], resp:"ERGSN CO., LTD.\n📍 #503 Susong BD, Seoae-ro 5-gil, Joong-gu, Seoul 04623, Korea\n📱 +82-10-5288-0006\n💬 Telegram: @ceodon\n📠 Fax: +82-50-4048-0006" },
  { intent:'competitor', kw:['fellowes','hsm','intimus','kobra','dahle','destroyit','amazon','competitor','brand'], followUp:['chain','oil','quote'], resp:"ERGSN differentiates from competitors with:\n• All-metal chain drive (no nylon/plastic gears)\n• Oil-free operation (zero maintenance cost)\n• Direct manufacturer pricing (no middleman markup)\n• CIF delivery to any port worldwide\n• GSA Schedule listed for U.S. government procurement\n\nOur machines are built for institutional-grade daily use, not consumer/office-retail." },
  { intent:'custom', kw:['custom','oem','odm','private label','brand','modify','special'], resp:"ERGSN supports OEM/ODM across sectors through our verified Korean partner network:\n• K-Security (DL Series) — private label, voltage mods (115V/220V), custom packaging\n• K-Tech — custom module specifications, Korean-fab precision builds, 2D→3D conversion contracts\n• K-Bio — white-label HFF formulations with HACCP/KFDA support\n• K-Smart Living — co-branded IoT / wellness devices\n• K-Culture Goods — licensed merchandise collaborations\n• K-Franchise — master-franchise territory agreements\n• K-Energy — solar / ESS configurations for your market\n\nMinimum order quantities apply. Submit an RFQ — we'll match you with the right verified Korean producer." },
  { intent:'k_tech_service', kw:['2d to 3d','2d->3d','2d→3d','stereoscopic','stereo','3d conversion','3d advert','3d ad','3d video','3d film','3d remaster','3d ott','ktech','k-tech','k tech','kt3d','kt-3d','kt3dad','kt3dvid','kt3dcine','dcp','stereo dcp','side-by-side','over-under','mvc','depth grading','glasses-free','hmd'], followUp:['sectors','verification','quote'], resp:"K-Tech · 2D → 3D Stereoscopic Conversion (ACTIVE)\nProprietary ERGSN conversion engine tuned per delivery surface (theater · 3D TV · DOOH · HMD · glasses-free displays).\n\n• KT-3DAD — 3D Advertising Production. Concept → storyboard → live shoot/CGI → stereoscopic finishing. 15s–3min master + social cutdowns. Turnaround 3–6 weeks.\n• KT-3DVID — General 2D → 3D Video Conversion. Corporate · training · event · documentary · broadcast episodic. Turnaround 2–4 weeks for ≤90 min.\n• KT-3DCINE — Feature Film 2D → 3D Remaster. Per-shot depth grading, stereo DCP delivery for theatrical re-release & OTT. Turnaround 8–16 weeks.\n\nAll services: up to 4K UHD, 8/10/12-bit, Side-by-Side / Over-Under / MVC / Frame-Packed. Per-scene depth grading with client review." },
  { intent:'k_bio_rosetta', kw:['rosetta','rosetta plus','hff','health functional food','kfda','haccp','mental wellness','cholecalciferol','glycosaminoglycan','depression','panic disorder','panic','psychosis','k-bio','kbio','k bio','endocannabinoid','macrophage','mucoda','lecithin','neurotransmitter','emulsion'], followUp:['sectors','verification','quote'], resp:"K-Bio · Rosetta Plus (ACTIVE)\nKFDA-assured Health Functional Food. Representative function: improvement of depression, psychosis, and panic disorder.\n\n• Certifications: HACCP · Health Functional Food assured by KFDA\n• Production capacity: 1,000+ units / month (large-scale, ready to scale)\n• Active export markets: Mexico, Yemen, India\n• Form: glycosaminoglycan emulsion (proto-molecular multimolecular bonding)\n• Process: microbial fermentation → secondary metabolite extraction\n• Three core raw materials: positive-electron carrier (cholecalciferol / endocannabinoid receptors / macrophage activation), per-mucoda anti-inflammatory / anti-cancer protein, unsaturated lecithin envelope for neurotransmitter delivery\n• Lead time: 4–6 weeks (volume-dependent)" },
  { intent:'k_beauty', kw:['k-beauty','kbeauty','k beauty','skincare','skin care','cosmetic','cosmetics','beauty device','beauty devices','cgmp','iso 22716','duty-free','duty free'], resp:"K-Beauty (Sourcing — joining 2026)\nPremium Korean skincare, color cosmetics, and beauty devices from audited Korean brands curated for global retail and duty-free.\n\n• Prioritized partners: CGMP · ISO 22716 · FDA/EU-registered formulators\n• Channels supported: duty-free · e-commerce · global retail\n• White-label / OEM available across formulations and device lines\n\nUse Spotlight or submit a sourcing inquiry to be matched with verified Korean K-Beauty partners as they onboard." },
  { intent:'k_culture_goods', kw:['k-culture','kculture','culture goods','kpop','k-pop','kpop merch','k-pop merchandise','licensed merchandise','hanbok','ceramic','ceramics','fashion accessory','fashion accessories','k-drama','kdrama','fandom','collector','official license'], resp:"K-Culture Goods (Sourcing — joining 2026)\nOfficially-licensed K-pop and K-drama merchandise, traditional Korean crafts, and designer fashion accessories.\n\n• K-pop / K-drama licensed merchandise (from rights-holding Korean IP consortiums)\n• Traditional crafts: hanbok, ceramics, heritage accessories\n• Designer fashion — contemporary Korean streetwear & luxury accessories\n• Channels: fandom retail · global DTC · duty-free · collector platforms\n\nEarly sourcing inquiries welcome via Spotlight." },
  { intent:'k_franchise', kw:['franchise','master franchise','cafe franchise','cafe','bakery','qsr','f&b','fnb','food and beverage','retail franchise','service franchise','brand licensing','territory','master-franchise','k-franchise','kfranchise'], resp:"K-Franchise (Sourcing — joining 2026)\nVerified Korean F&B, café, retail, and service franchise systems.\n\n• Turnkey brand licensing with operations playbooks\n• Master-franchise territory-exclusive structures available\n• Supply chain, training, and concept handover included\n• Covers: café · bakery · QSR · beauty retail · lifestyle retail · service concepts\n\nApplicable for groups seeking single-territory or multi-country master rights. Pilot enquiries accepted via Spotlight or direct RFQ." },
  { intent:'k_smart_living', kw:['k-smart','ksmart','smart living','connected appliance','iot appliance','wellness device','smart home','k-lifestyle','klifestyle','lifestyle good'], resp:"K-Smart Living (Sourcing — joining 2026)\nConnected Korean appliances, wellness devices, and premium lifestyle goods curated for global retail.\n\n• Categories: IoT appliances · wellness & beauty-tech · premium lifestyle goods\n• Co-branded / OEM arrangements supported\n• Suitable for global retail, hospitality and curated e-commerce\n\nSpotlight currently includes K-Beauty Smart Mirror (concept stage) as a representative K-Smart Living preview item." },
  { intent:'k_energy', kw:['hygen','generator','one shaft','single shaft','shared shaft','multi-generator','dc 24v','dc24v','1 rpm','low rpm','400w','ke-option','keoption','keoa','keob','keoc','keod','k-energy','kenergy','future energy','solar','ess','battery storage','renewable','clean-tech','clean tech','energy storage','iec 62619','iec','ev cell','bos','photovoltaic','pv module','grid-tied'], followUp:['sectors','verification','quote'], resp:"K-Energy · HYGEN Generator (ACTIVE)\nKorean HYGEN architecture — a single DC 24V / 400W motor rotates one shared shaft at 1 rpm, driving multiple generators in parallel. Each generator outputs 150–200 W; the number of generators per shaft is adjustable.\n\nFour configurations:\n• KE-Option A — 5 generators · 1 set · ≈1.0 kW/h (compact starter, 80×30×30 cm, ≈60 kg)\n• KE-Option B — 6 generators · 1 set · ≈1.2 kW/h (standard single set)\n• KE-Option C — 12 generators · 2 sets · ≈2.4 kW/h (dual-set combo)\n• KE-Option D — 18 generators · 3 sets · ≈3.6 kW/h (flagship, N+1 drive redundancy)\n\nAll units share the same compact chassis (80×30×30 cm, ≈60 kg per set) and DC 24V bus — suitable for solar / ESS integration, off-grid micro-grids, and distributed backup." },
  { intent:'capacity', kw:['office','people','employees','volume','capacity','daily','many','sheets per day','kw','kwh','kilowatt','watt','generator load','units per month','units/month','monthly volume','runtime','minutes','feature length'], resp:null, handler:'handleCapacity' },
  { intent:'spec', kw:['spec','specification','detail','feature','info about','tell me about'], resp:null, handler:'handleSpec' },
  { intent:'compare', kw:['compare','vs','versus','difference','better','or'], resp:null, handler:'handleCompareText' },
  { intent:'recommend', kw:['recommend','suggest','which','best','right','need','looking for','suitable'], resp:null, handler:'handleRecommendText' },
  { intent:'quote', kw:['quote','rfq','inquiry','order','buy','purchase','get a quote'], resp:null, handler:'handleQuoteChat' },
  { intent:'model_query', kw:['dl-10x','dl-12x','dl-16x','dl10x','dl12x','dl16x','10xd','12xd','16xd','kt-3dad','kt3dad','kt-3dvid','kt3dvid','kt-3dcine','kt3dcine','rosetta','rosetta plus','rosettaplus','ke-option a','ke-option b','ke-option c','ke-option d','keoa','keob','keoc','keod','hygen','hygen generator'], resp:null, handler:'handleSpec' }
];

// Synonym expansion for broader matching
const SYNONYMS = {
  'shredder':['machine','device','unit','equipment','product','model','destroyer'],
  'buy':['purchase','order','acquire','get','procure'],
  'fast':['quick','speed','rapid','fpm','throughput'],
  'big':['large','heavy','industrial','flagship','high-capacity','high capacity'],
  'small':['compact','mini','deskside','entry','personal'],
  'noise':['quiet','silent','loud','sound','db','decibel'],
  'size':['dimension','footprint','height','width','depth','weight','heavy'],
  'paper':['document','sheet','page','file','record'],
  'safe':['secure','security','confidential','classified','destroy','destruction']
};

function expandText(text) {
  let expanded = text.toLowerCase();
  for (const [root, syns] of Object.entries(SYNONYMS)) {
    for (const s of syns) { if (expanded.includes(s)) expanded += ' ' + root; }
  }
  return expanded;
}

function matchIntent(text) {
  const expanded = expandText(text);
  const results = [];
  for (const entry of KB) {
    let score = 0;
    for (const kw of entry.kw) {
      if (expanded.includes(kw)) score += kw.length + (kw.length > 4 ? 3 : 0);
    }
    if (score > 0) results.push({ entry, score });
  }
  results.sort((a,b) => b.score - a.score);
  return results.length > 0 ? { best: results[0].entry, confidence: results[0].score, top3: results.slice(0,3) } : null;
}

// Level 3 skeleton: Claude API call (inactive until CLAUDE_API_ENDPOINT is set)
async function callClaudeAPI(text) {
  if (!CLAUDE_API_ENDPOINT) return null;
  try {
    const sysPrompt = `You are the ERGSN Trade Advisor. ERGSN CO., LTD. is a Seoul-based trade gateway / platform (est. 2013) that curates verified Korean producers for global buyers.

ACTIVE sectors (products ready to quote):
- K-Security: DL Series industrial shredders (DL-10X, DL-12X, DL-16X, DL-10XD, DL-12XD, DL-16XD). All models Level 3 / P-4 cross-cut, all-metal chain drive, oil-free, HIPAA · GSA Schedule. DL-16XD flagship: up to 90 sheets/pass at 31 FPM, 3.25 Hp, 115V/30A NEMA L5-30P.
- K-Tech: proprietary 2D → 3D stereoscopic conversion services — KT-3DAD (3D advertising production, 3–6 wk), KT-3DVID (2D→3D video conversion, 2–4 wk for ≤90 min), KT-3DCINE (feature-film 3D remaster, 8–16 wk). Output up to 4K UHD, Side-by-Side / Over-Under / MVC / Frame-Packed / Stereo DCP.
- K-Energy: HYGEN Generator — a single DC 24V / 400W motor rotates one shared shaft at 1 rpm, driving multiple generators (150–200 W each) in parallel. Four configurations: KE-Option A (5 gen · 1 set · ≈1.0 kW/h), KE-Option B (6 gen · 1 set · ≈1.2 kW/h), KE-Option C (12 gen · 2 sets · ≈2.4 kW/h), KE-Option D (18 gen · 3 sets · ≈3.6 kW/h flagship). Unit chassis 80×30×30 cm / ≈60 kg, 10 output ports per set.
- K-Bio: Rosetta Plus HFF — HACCP-certified, KFDA-assured Health Functional Food, representative function of improving depression, psychosis and panic disorder. Capacity 1,000+ units/month. Already exporting to Mexico, Yemen, India.

SOURCING in 2026 (partner-matching in progress — direct to RFQ for early inquiries): K-Beauty · K-Culture Goods (K-pop merch, crafts, fashion) · K-Franchise (F&B, retail, service master-franchise) · K-Smart Living (IoT appliances, wellness) · K-Tourism Assets (MICE, medical tourism, hospitality tech).

Trade: CIF any major port, T/T 50%/50%, 4–6 wk lead time for DL Series. Never quote exact prices — redirect to RFQ form. Be concise (under 150 words). Support EN/ES/AR/FR/JA/TR/zh-Hans/zh-Hant.`;
    const resp = await fetch(CLAUDE_API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system: sysPrompt, message: text, context: chatContext.lastModel || '' })
    });
    const data = await resp.json();
    return data.reply || null;
  } catch(e) { return null; }
}

function showFollowUp(intent) {
  if (!intent.followUp || !intent.followUp.length) return;
  const unused = intent.followUp.filter(t => !chatContext.topics.includes(t));
  if (!unused.length) return;
  setTimeout(() => {
    const body = document.getElementById('chatBody');
    const div = document.createElement('div'); div.className = 'chat-options';
    div.style.cssText = 'border-top:1px solid #292929;padding-top:8px;margin-top:6px;';
    const label = document.createElement('span');
    label.style.cssText = 'font-size:10px;color:var(--tx-lt);display:block;margin-bottom:6px;';
    label.textContent = cl('followup');
    div.appendChild(label);
    unused.slice(0,3).forEach(t => {
      const kb = KB.find(k => k.intent === t); if (!kb) return;
      const b = document.createElement('button'); b.className = 'chat-opt';
      b.textContent = kb.intent.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
      b.onclick = () => { div.remove(); chatUserMsg(b.textContent); respondToIntent(kb, b.textContent); };
      div.appendChild(b);
    });
    body.appendChild(div); body.scrollTop = body.scrollHeight;
  }, 400);
}

function respondToIntent(intent, text) {
  ctxTopic(intent.intent);
  const techNote = cl('techNote');
  if (intent.resp) {
    // Model-specific enrichment: if context has a model and response is generic
    let response = intent.resp;
    if (chatContext.lastModel && intent.intent === 'voltage') {
      const p = P[chatContext.lastModel];
      const v = p.specs.find(s => s[0].toLowerCase().includes('volt'));
      const a = p.specs.find(s => s[0].toLowerCase().includes('amp'));
      if (v || a) response = `For the ${p.model}:\n• ${v ? v[0]+': '+v[1] : ''}\n${a ? '• '+a[0]+': '+a[1] : ''}\n\n` + response;
    }
    chatBotMsg(response + techNote, () => {
      if (intent.intent === 'price' || intent.intent === 'quote') {
        chatOpts([{ label: cl('quote') + ' →', action: () => chatStep('start') }]);
      } else {
        showFollowUp(intent);
      }
    });
  } else if (intent.handler) {
    window[intent.handler](text);
  }
}

async function handleChatInput() {
  const input = document.getElementById('chatInput');
  const rawText = input.value.trim();
  if (!rawText) return;
  input.value = '';
  chatUserMsg(rawText);
  ctxPush('user', rawText);
  inferProfile(rawText);

  // ① Conversational patterns (yes/no/more/thanks)
  for (const pat of CONV_PATTERNS) {
    if (pat.re.test(rawText)) { window[pat.handler](); return; }
  }

  // ② Fuzzy correct typos then expand synonyms
  const corrected = fuzzyCorrect(rawText);
  const mentioned = findModelInText(corrected);
  if (mentioned) chatContext.lastModel = mentioned;

  // ③ Dynamic spec lookup (e.g. "what's the waste bin of DL-12X?")
  const specResult = dynamicSpecLookup(corrected);
  if (specResult) {
    chatBotMsg(`${specResult.model} — ${specResult.key}: ${specResult.value}${profileEnrich('')}${cl('techNote')}`, () => {
      chatOpts([
        { label: `All ${specResult.model} Specs`, action: () => handleSpec(specResult.model) },
        { label: cl('quote') + ' →', action: () => { chatState.model=chatContext.lastModel; chatAskQualification(); }},
      ]);
    });
    ctxPush('bot', specResult.key);
    maybePromptQuote();
    return;
  }

  // ④ Intent matching with synonym expansion
  const match = matchIntent(corrected);
  const allMatches = match ? match.top3.filter(r => r.score >= 4) : [];

  // Composite: 2+ strong intents
  if (allMatches.length >= 2) {
    const intents = allMatches.map(r => r.entry);
    let combined = '';
    intents.forEach((intent, i) => {
      ctxTopic(intent.intent);
      if (intent.resp) combined += (i > 0 ? '\n\n---\n\n' : '') + intent.resp;
    });
    if (combined) {
      chatBotMsg(combined + profileEnrich(combined) + cl('techNote'), () => {
        showFollowUp(intents[intents.length - 1]);
      });
      ctxPush('bot', combined);
      maybePromptQuote();
      return;
    }
  }

  // Single high-confidence intent
  if (match && match.confidence >= 4) {
    respondToIntent(match.best, corrected);
    ctxPush('bot', match.best.resp || match.best.intent);
    maybePromptQuote();
    return;
  }

  // Context-aware pronouns
  if (chatContext.lastModel && /\b(it|this|that|its|the model|this one)\b/i.test(corrected)) {
    handleSpec(corrected);
    return;
  }

  // Level 3: Claude API
  if (CLAUDE_API_ENDPOINT) {
    const body = document.getElementById('chatBody');
    const typing = document.createElement('div');
    typing.className = 'chat-typing';
    typing.innerHTML = '<span></span><span></span><span></span>';
    body.appendChild(typing); body.scrollTop = body.scrollHeight;
    const reply = await callClaudeAPI(corrected);
    typing.remove();
    if (reply) { chatBotMsg(reply); ctxPush('bot', reply); return; }
  }

  // Smart fallback
  if (match && match.top3.length > 0) {
    const suggestions = match.top3.map(r => r.entry);
    chatBotMsg(cl('fallback'), () => {
      chatOpts(suggestions.map(s => ({
        label: s.intent.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()),
        action: () => { respondToIntent(s, corrected); }
      })).concat([{ label: cl('human'), action: () => showHumanContact() }]));
    });
    return;
  }

  // No match
  chatBotMsg(cl('fallback'), () => {
    chatOpts([
      { label: 'Product Specs', action: () => handleQuoteChat() },
      { label: 'HIPAA / GSA', action: () => respondToIntent(KB.find(k=>k.intent==='hipaa'),'') },
      { label: 'Shipping & Trade', action: () => respondToIntent(KB.find(k=>k.intent==='shipping'),'') },
      { label: cl('quote'), action: () => chatStep('start') },
      { label: cl('human'), action: () => showHumanContact() }
    ]);
  });
}

function showHumanContact() {
  chatBotMsg("Our team is ready to help!\n\n💬 Telegram: @ceodon\n📱 +82-10-5288-0006\n\nWe typically respond within 1 business day (Seoul time, UTC+9).", () => {
    chatOpts([
      { label: 'Open Telegram', action: () => window.open('https://t.me/ceodon','_blank') },
      { label: 'Request Quote', action: () => { location.hash = '#rfq'; } },
      { label: 'New Question', action: () => restartChat() }
    ]);
  });
}

function handleSpec(text) {
  const id = findModelInText(text) || chatContext.lastModel;
  if (!id) {
    chatBotMsg("Which model would you like to know about?", () => {
      chatOpts(MODEL_IDS.map(mid => ({ label: P[mid].model, action: () => { chatContext.lastModel=mid; handleSpec(mid); }})));
    });
    return;
  }
  chatContext.lastModel = id;
  ctxTopic('spec');
  const p = P[id];
  chatBotMsg(`${p.model} — ${p.sub}\nPart No: ${p.part}\n\n${fmtSpecs(id)}${cl('techNote')}`, () => {
    chatOpts([
      { label: cl('specs'), action: () => { chatContext.awaitingReturn = { type:'browse', model: id }; toggleChat(); openModal(id); }},
      { label: cl('quote') + ' →', action: () => { chatState.model=id; chatAskQualification(); }},
      { label: 'Compare', action: () => chatBotMsg("Type: \"Compare " + p.model + " vs [other model]\"") },
    ]);
  });
  ctxPush('bot', p.model + ' specs');
}

function handleCompareText(text) {
  const t = text.toLowerCase().replace(/\s+/g,' ');
  const found = [];
  for (const id of SHREDDER_IDS) {
    const code = id.replace('dl','dl-');
    if (t.includes(code) || t.includes(id) || t.includes(P[id].model.toLowerCase())) {
      if (!found.includes(id)) found.push(id);
    }
  }
  if (found.length >= 2) {
    const result = fmtCompare(found[0], found[1]);
    chatBotMsg(result || "Could not compare those models.");
    return;
  }
  // Non-shredder sector comparison is not spec-for-spec compatible
  const nonShredder = [...KTECH_IDS, ...KBIO_IDS, ...KENERGY_IDS].filter(id => t.includes(id) || t.includes(P[id].model.toLowerCase()));
  if (nonShredder.length >= 1) {
    chatBotMsg("Spec-to-spec comparison is currently available within the DL Series (K-Security) and across KE-Option A/B/C/D (K-Energy HYGEN). K-Tech services (KT-3DAD / KT-3DVID / KT-3DCINE) and K-Bio Rosetta Plus use different spec dimensions — ask me about any of them individually and I'll walk through the details.");
    return;
  }
  chatBotMsg("Which two DL Series models would you like to compare? For example: \"Compare DL-12X vs DL-16XD\"");
}

function handleCapacity(text) {
  const lower = text.toLowerCase();
  // If the query explicitly names a non-shredder product, go straight to its spec sheet.
  const nonShredderHint = findModelInText(text);
  if (nonShredderHint && !SHREDDER_IDS.includes(nonShredderHint)) { handleSpec(nonShredderHint); return; }
  // Sector dispatch — route to the sector-specific recommender that matches the user's vocabulary.
  if (/(\bkw\b|\bkwh\b|kilo[- ]?watt|\bwatt\b|\d\s*w\b|hygen|generator|off[- ]?grid|micro[- ]?grid|\bess\b|\bsolar\b|backup power|power load|continuous load|kw\/h|발전)/i.test(lower)) {
    return handleCapacityKEnergy(text);
  }
  if (/(rosetta|hff|health functional|kfda|haccp|depression|psychosis|panic|mental wellness|bottle|capsule|dose|supplement|k-bio|kbio|units?\s*\/\s*month|units? per month|monthly volume)/i.test(lower)) {
    return handleCapacityKBio(text);
  }
  if (/(3d|stereoscop|kt-3d|kt3d|\bvideo\b|\bfilm\b|feature|advert|\bad\b|\bads\b|commercial|campaign|episode|broadcast|dcp|cinema|theatrical|remaster|documentary|training video|corporate video|dooh)/i.test(lower)) {
    return handleCapacityKTech(text);
  }
  // Default: DL Series shredder recommendation (K-Security).
  return handleCapacityKSecurity(text);
}

function handleCapacityKSecurity(text) {
  const lower = text.toLowerCase();
  const num = parseInt(text.match(/(\d+)/)?.[1] || '0');
  const needsHipaa = /hipaa|medical|hospital|health/i.test(lower);
  const needsGsa = /gsa|government|federal/i.test(lower);
  let rec;
  if (num <= 15) rec = lower.includes('high') || num > 100 ? 'dl10xd' : 'dl10x';
  else if (num <= 50) rec = lower.includes('heavy') || lower.includes('high') ? 'dl16x' : 'dl12x';
  else rec = lower.includes('space') || lower.includes('compact') ? 'dl12xd' : 'dl16xd';
  if (needsHipaa && rec === 'dl10x') rec = 'dl12x';
  chatContext.lastModel = rec;
  ctxTopic('recommend');
  const p = P[rec];
  let response = `Based on your needs, I recommend the ${p.model}.\n\n${p.sub}\n• ${p.specs.find(s=>s[0]==='Sheet Capacity')?.[1] || ''} capacity\n• ${p.specs.find(s=>s[0]==='Entry Width')?.[1] || ''} entry width\n• ${p.specs.find(s=>s[0]==='Motor')?.[1] || ''} motor`;
  if (needsHipaa) response += '\n\n\u2713 HIPAA Compliant \u2014 P-4 security level for PHI destruction';
  if (needsGsa) response += '\n\u2713 GSA Schedule listed \u2014 eligible for federal procurement';
  recommendFollowUp(rec, response);
}

function handleCapacityKEnergy(text) {
  const lower = text.toLowerCase();
  // Extract a kilowatt figure. Supports "2 kw", "2.4kwh", "2000w", "500 watt".
  let kw = 0;
  const kwMatch = lower.match(/(\d+(?:\.\d+)?)[\s-]*(?:kilowatt|kwh|kw)/);
  const wMatch = lower.match(/(\d+(?:\.\d+)?)[\s-]*(?:watt|w)\b/);
  if (kwMatch) kw = parseFloat(kwMatch[1]);
  else if (wMatch) kw = parseFloat(wMatch[1]) / 1000;
  let rec;
  if (kw > 0 && kw <= 1.0) rec = 'keoa';
  else if (kw > 0 && kw <= 1.3) rec = 'keob';
  else if (kw > 0 && kw <= 2.6) rec = 'keoc';
  else if (kw > 0) rec = 'keod';
  if (!rec) {
    chatBotMsg("K-Energy HYGEN Generator comes in four configurations. All share the 80\u00d730\u00d730 cm chassis, DC 24V / 400W drive motor, 1 rpm shaft, and 150\u2013200 W per generator:\n\n\u2022 KE-Option A \u2014 \u22481.0 kW/h (5 gen \u00b7 1 set) \u2014 residential backup / micro-loads\n\u2022 KE-Option B \u2014 \u22481.2 kW/h (6 gen \u00b7 1 set) \u2014 small-business / workshop baseline\n\u2022 KE-Option C \u2014 \u22482.4 kW/h (12 gen \u00b7 2 sets) \u2014 sustained commercial load, small micro-grid\n\u2022 KE-Option D \u2014 \u22483.6 kW/h (18 gen \u00b7 3 sets, flagship) \u2014 off-grid campus, ESS-tied, N+1 drive\n\nTell me your target continuous load (in kW or watts) and I\u2019ll recommend the best fit.");
    return;
  }
  chatContext.lastModel = rec;
  ctxTopic('recommend');
  const p = P[rec];
  const outSpec = p.specs.find(s => /output/i.test(s[0]) && /kw/i.test(s[1]));
  const confSpec = p.specs.find(s => /configuration/i.test(s[0]));
  const motorSpec = p.specs.find(s => /drive motor/i.test(s[0]));
  const portSpec = p.specs.find(s => /output ports/i.test(s[0]));
  const response = `For a continuous load around ${kw} kW, I recommend the ${p.model}.\n\n${p.sub}\n\u2022 ${confSpec ? confSpec[0]+': '+confSpec[1] : ''}\n\u2022 ${outSpec ? outSpec[0]+': '+outSpec[1] : ''}\n\u2022 ${motorSpec ? motorSpec[0]+': '+motorSpec[1] : ''}\n\u2022 ${portSpec ? portSpec[0]+': '+portSpec[1] : ''}`;
  recommendFollowUp(rec, response);
}

function handleCapacityKBio(text) {
  const lower = text.toLowerCase();
  const num = parseInt((text.match(/(\d[\d,]*)\s*(?:units?|bottles?|doses?|capsules?|pcs|\/month|per month|a month)/i)?.[1] || '').replace(/,/g, '') || text.match(/(\d[\d,]*)/)?.[1]?.replace(/,/g, '') || '0');
  const rec = 'rosettaplus';
  chatContext.lastModel = rec;
  ctxTopic('recommend');
  const p = P[rec];
  let sizingNote;
  if (num && num < 500) sizingNote = `Pilot volume (${num} units/month) \u2014 below our 1,000+ units/month standard run. We can batch a smaller pilot under HACCP control; minimum order confirmed on the Proforma Invoice.`;
  else if (num && num <= 1000) sizingNote = `Standard volume (${num} units/month) \u2014 well within our 1,000+ units/month capacity. 4\u20136 weeks lead time, HACCP lot-batched, export documentation included.`;
  else if (num) sizingNote = `High-volume (${num} units/month) \u2014 exceeds a single production line. We\u2019ll propose a phased ramp with parallel lot runs; timing confirmed on the Proforma Invoice.`;
  else sizingNote = 'Rosetta Plus runs at 1,000+ units/month (HACCP-certified, KFDA-assured). Share your target monthly volume and I\u2019ll confirm lead time and lot batching.';
  const response = `${p.model} \u2014 ${p.sub}\n\n${sizingNote}\n\nCertifications: HACCP \u00b7 KFDA. Currently exporting to Mexico, Yemen, and India.`;
  recommendFollowUp(rec, response);
}

function handleCapacityKTech(text) {
  const lower = text.toLowerCase();
  let rec;
  // Content type takes priority over runtime for routing.
  if (/(feature|cinema|theatrical|remaster|dcp|\bfilm\b)/i.test(lower)) rec = 'kt3dcine';
  else if (/(advert|\bad\b|\bads\b|commercial|campaign|launch|dooh|brand spot)/i.test(lower)) rec = 'kt3dad';
  else if (/(video|corporate|training|event|documentary|broadcast|episode|episodic)/i.test(lower)) rec = 'kt3dvid';
  else {
    const minMatch = lower.match(/(\d+(?:\.\d+)?)[\s-]*(?:min|minute)/);
    const secMatch = lower.match(/(\d+(?:\.\d+)?)[\s-]*(?:sec|second)/);
    const minutes = minMatch ? parseFloat(minMatch[1]) : (secMatch ? parseFloat(secMatch[1]) / 60 : 0);
    if (minutes >= 60) rec = 'kt3dcine';
    else if (minutes > 0 && minutes <= 3) rec = 'kt3dad';
    else if (minutes > 0) rec = 'kt3dvid';
  }
  if (!rec) {
    chatBotMsg("K-Tech 2D \u2192 3D has three delivery tracks:\n\n\u2022 KT-3DAD \u2014 brand / product / DOOH ads, 15 s \u2013 3 min, 3\u20136 weeks\n\u2022 KT-3DVID \u2014 corporate, training, event, broadcast video, 2\u20134 weeks for \u226490 min\n\u2022 KT-3DCINE \u2014 feature-length film remaster, 8\u201316 weeks, stereo DCP\n\nTell me the content type and runtime (e.g. '45-second ad', '30-min training video', '90-min feature') and I\u2019ll point to the right service.");
    return;
  }
  chatContext.lastModel = rec;
  ctxTopic('recommend');
  const p = P[rec];
  const useSpec = p.specs.find(s => /use case/i.test(s[0]));
  const turnSpec = p.specs.find(s => /turnaround/i.test(s[0]));
  const resSpec = p.specs.find(s => /max resolution/i.test(s[0]));
  const response = `For that brief, I recommend the ${p.model}.\n\n${p.sub}\n\u2022 ${useSpec ? useSpec[0]+': '+useSpec[1] : ''}\n\u2022 Turnaround: ${turnSpec?.[1] || ''}\n\u2022 Max resolution: ${resSpec?.[1] || ''}`;
  recommendFollowUp(rec, response);
}

function recommendFollowUp(rec, response) {
  chatBotMsg(response + cl('techNote'), () => {
    chatOpts([
      { label: cl('specs'), action: () => { chatContext.awaitingReturn = { type:'browse', model: rec }; toggleChat(); openModal(rec); }},
      { label: cl('quote') + ' \u2192', action: () => { chatState.model = rec; chatAskQualification(); }}
    ]);
  });
  const p = P[rec]; if (p) ctxPush('bot', 'recommended ' + p.model);
}

function handleRecommendText(text) { handleCapacity(text); }

function handleQuoteChat() {
  chatStep('quote_direct');
}

const CHAT_TREE = {
  start: {
    msg: "Hello, and thank you for visiting ERGSN.\n\nERGSN is Korea's certified trade gateway : every product passes our 4-step verification (vendor audit · quality testing · compliance · long-term partnership) before we offer it to global buyers.\n\nActive catalog (ready to quote):\n• K-Security : DL Series industrial shredders (GSA Schedule, U.S. defense procured)\n• K-Tech : 2D → 3D stereoscopic conversion (KT-3DAD / KT-3DVID / KT-3DCINE)\n• K-Energy : HYGEN Generator (KE-Option A / B / C / D)\n• K-Bio : Rosetta Plus HFF (HACCP · KFDA, exporting to MX/YE/IN)\n\nSourcing partners for 2026 : K-Beauty · K-Culture Goods · K-Franchise · K-Smart Living.\n\nHow may I assist you today?",
    opts: [
      { label: 'Browse K-Security (DL Series)', next: 'browse_models' },
      { label: 'Browse K-Tech 3D services', next: 'browse_ktech' },
      { label: 'Browse K-Energy (HYGEN Generator)', next: 'browse_kenergy' },
      { label: 'Ask about K-Bio (Rosetta Plus)', next: 'browse_kbio' },
      { label: 'Upcoming sectors (K-Beauty / Culture / Franchise / Smart Living)', next: 'browse_sourcing' },
      { label: 'About ERGSN & verification', next: 'about_company' },
      { label: 'Trade terms (CIF, payment, shipping)', next: 'trade_info' },
      { label: 'Request a quote directly', next: 'quote_direct' }
    ]
  },
  find_office_size: {
    msg: "Of course. To recommend the most suitable model, may I ask the size of your office?",
    opts: [
      { label: 'Small (1\u201315 people)', next: 'vol_small' },
      { label: 'Medium (15\u201350)', next: 'vol_med' },
      { label: 'Large (50+)', next: 'vol_large' }
    ]
  },
  browse_models: {
    msg: "K-Security catalog — six DL Series cross-cut shredders, all manufactured by ERGSN CO., LTD. (verified partner). Level 3 / P-4, all-metal chain drive, oil-free, HIPAA · GSA Schedule. Which model would you like to learn about?",
    opts: [
      { label: 'DL-10X', action: 'browse_dl10x' },
      { label: 'DL-12X', action: 'browse_dl12x' },
      { label: 'DL-16X', action: 'browse_dl16x' },
      { label: 'DL-10XD', action: 'browse_dl10xd' },
      { label: 'DL-12XD', action: 'browse_dl12xd' },
      { label: 'DL-16XD (Flagship)', action: 'browse_dl16xd' },
      { label: 'Help me pick by office size', next: 'find_office_size' }
    ]
  },
  browse_ktech: {
    msg: "K-Tech · 2D → 3D Stereoscopic Conversion (ACTIVE). Proprietary ERGSN conversion engine tuned per delivery surface (theater · 3D TV · DOOH · HMD · glasses-free displays). Which service would you like to learn about?",
    opts: [
      { label: 'KT-3DAD — 3D Advertising Production', action: 'browse_kt3dad' },
      { label: 'KT-3DVID — 2D → 3D Video Conversion', action: 'browse_kt3dvid' },
      { label: 'KT-3DCINE — Feature Film 3D Remaster', action: 'browse_kt3dcine' }
    ]
  },
  browse_kbio: {
    msg: "K-Bio · Rosetta Plus (ACTIVE). KFDA-assured Health Functional Food with representative function of improving depression, psychosis and panic disorder. HACCP production; 1,000+ units/month capacity; currently exporting to Mexico, Yemen and India. What would you like to see?",
    opts: [
      { label: 'View Rosetta Plus full spec sheet', action: 'browse_rosettaplus' },
      { label: 'Request a Rosetta Plus quote', action: 'quote_rosettaplus' }
    ]
  },
  browse_kenergy: {
    msg: "K-Energy · HYGEN Generator (ACTIVE). One DC 24V / 400W motor drives multiple generators at 1 rpm on a shared rotation shaft — each generator delivers 150–200 W, and the number of generators per shaft is adjustable. Four configurations:\n\n• KE-Option A — 5 generators · 1 set · ≈1.0 kW/h\n• KE-Option B — 6 generators · 1 set · ≈1.2 kW/h (standard)\n• KE-Option C — 12 generators · 2 sets · ≈2.4 kW/h (dual)\n• KE-Option D — 18 generators · 3 sets · ≈3.6 kW/h (flagship)\n\nWhich option would you like to learn about?",
    opts: [
      { label: 'KE-Option A — 5-Gen Starter', action: 'browse_keoa' },
      { label: 'KE-Option B — 6-Gen Standard', action: 'browse_keob' },
      { label: 'KE-Option C — Dual-Set Combo', action: 'browse_keoc' },
      { label: 'KE-Option D — Triple-Set Flagship', action: 'browse_keod' }
    ]
  },
  browse_sourcing: {
    msg: "Sectors we're sourcing in 2026 — pilot enquiries and early-access buyers welcome now via Spotlight:\n\n• K-Beauty — skincare · cosmetics · beauty devices (CGMP · ISO 22716 priority)\n• K-Culture Goods — licensed K-pop / K-drama merchandise · traditional crafts · fashion\n• K-Franchise — turnkey F&B / café / retail / service concepts with master-franchise\n• K-Smart Living — connected appliances · wellness · lifestyle goods\n• K-Tourism Assets — MICE infrastructure · medical-tourism concierge · hospitality tech\n\nWhat would you like to do?",
    opts: [
      { label: 'Submit a sourcing inquiry', next: 'quote_direct' },
      { label: 'Trade terms', next: 'trade_info' }
    ]
  },
  about_company: {
    msg: "ERGSN CO., LTD. is a Seoul-based trade gateway founded in 2013. Rather than a single-product seller, we are a curator: every manufacturer in our network passes our 4-step verification (Vendor Audit \u2192 Quality Verification \u2192 Compliance Check \u2192 Long-term Partnership) before their products are offered to global buyers.\n\nOur first verified partner is ERGSN CO., LTD. itself \u2014 manufacturing the DL Series shredders that have been GSA Schedule listed and procured by U.S. defense agencies for over a decade through Capital Shredder Corp. (Rockville, MD).\n\nWould you like to know more?",
    opts: [
      { label: 'See the verification process', next: 'verify_detail' },
      { label: 'Trade terms', next: 'trade_info' }
    ]
  },
  verify_detail: {
    msg: "Our 4-Step Verification:\n\n1. Vendor Audit \u2014 on-site facility inspection, financials, 3-year operational history\n2. Quality Verification \u2014 independent product testing against DIN/ISO/ANSI standards\n3. Compliance Check \u2014 export documentation, HS codes, target-market regulations (HIPAA, GSA, CE)\n4. Long-term Partnership \u2014 formal supply agreement, dedicated account management, ongoing quality monitoring\n\nThis is why our buyers know that anything they purchase through ERGSN has already been thoroughly vetted.",
    opts: [
      { label: 'Request a quote', next: 'quote_direct' }
    ]
  },
  trade_info: {
    msg: "Standard trade terms:\n\n\u2022 Incoterms: CIF to any major port worldwide (FOB, CFR, EXW also available)\n\u2022 Payment: T/T 50% advance, 50% before shipment (L/C negotiable)\n\u2022 Lead time: 4\u20136 weeks from advance payment\n\u2022 HS Code: 8472.90\n\u2022 Packaging: Individual crating for ocean freight\n\nMay I help with anything else?",
    opts: [
      { label: 'Request a quote directly', next: 'quote_direct' }
    ]
  },
  quote_direct: {
    msg: "I can set up a formal quote request for you. Which product are you interested in?",
    opts: [
      { label: 'DL-10X (K-Security)', action: 'quote_dl10x' },
      { label: 'DL-12X (K-Security)', action: 'quote_dl12x' },
      { label: 'DL-16X (K-Security)', action: 'quote_dl16x' },
      { label: 'DL-10XD (K-Security)', action: 'quote_dl10xd' },
      { label: 'DL-12XD (K-Security)', action: 'quote_dl12xd' },
      { label: 'DL-16XD \u2014 Flagship (K-Security)', action: 'quote_dl16xd' },
      { label: 'KT-3DAD \u2014 3D Advertising (K-Tech)', action: 'quote_kt3dad' },
      { label: 'KT-3DVID \u2014 2D\u21923D Video (K-Tech)', action: 'quote_kt3dvid' },
      { label: 'KT-3DCINE \u2014 Feature Film 3D (K-Tech)', action: 'quote_kt3dcine' },
      { label: 'KE-Option A \u2014 HYGEN 5-Gen (K-Energy)', action: 'quote_keoa' },
      { label: 'KE-Option B \u2014 HYGEN 6-Gen (K-Energy)', action: 'quote_keob' },
      { label: 'KE-Option C \u2014 HYGEN Dual-Set (K-Energy)', action: 'quote_keoc' },
      { label: 'KE-Option D \u2014 HYGEN Triple-Set (K-Energy)', action: 'quote_keod' },
      { label: 'Rosetta Plus (K-Bio)', action: 'quote_rosettaplus' },
      { label: 'Not sure yet \u2014 help me choose', next: 'find_office_size' }
    ]
  },
  vol_small: {
    msg: "Got it \u2014 small office. How many pages do you shred per day?",
    opts: [
      { label: 'Under 100 pages', next: 'sec_s_low' },
      { label: '100\u2013300 pages', next: 'sec_s_high' }
    ]
  },
  vol_med: {
    msg: "Medium office. Daily shredding volume?",
    opts: [
      { label: 'Under 200 pages', next: 'sec_m_low' },
      { label: '200\u2013500 pages', next: 'sec_m_high' }
    ]
  },
  vol_large: {
    msg: "Large operation. What's your priority?",
    opts: [
      { label: 'High throughput', next: 'rec_dl16xd' },
      { label: 'Space efficient', next: 'rec_dl10xd' },
      { label: 'Balanced', next: 'rec_dl12xd' }
    ]
  },
  sec_s_low:   { msg: "For a small office with light volume, the compact DL-10X is perfect.", opts: [], rec: 'dl10x' },
  sec_s_high:  { msg: "You need more capacity. The DL-10XD handles up to 42 sheets per pass in a compact form.", opts: [], rec: 'dl10xd' },
  sec_m_low:   { msg: "The DL-12X is our most popular mid-size model \u2014 26 sheets, 12\xBC\" entry.", opts: [], rec: 'dl12x' },
  sec_m_high:  { msg: "For heavier mid-office use, the DL-16X with its wide 16\xBC\" entry is ideal.", opts: [], rec: 'dl16x' },
  rec_dl16xd:  { msg: "The DL-16XD is our flagship \u2014 up to 90 sheets at 31 FPM. Maximum throughput.", opts: [], rec: 'dl16xd' },
  rec_dl10xd:  { msg: "The DL-10XD packs 42 sheets/pass into a compact 10\" chassis. Great for tight spaces.", opts: [], rec: 'dl10xd' },
  rec_dl12xd:  { msg: "The DL-12XD offers the best balance \u2014 45 sheets in a mid-size frame.", opts: [], rec: 'dl12xd' }
};

const chatState = { model: null, incoterm: null, country: null, port: null, qual: { volume:null, timeline:null, experience:null, payment:null, tier:null } };
let chatOpen = false;

function toggleChat(){
  chatOpen = !chatOpen;
  const panel = document.getElementById('chatPanel');
  panel.classList.toggle('open', chatOpen);
  panel.setAttribute('aria-hidden', chatOpen ? 'false' : 'true');
  if(chatOpen && !document.getElementById('chatBody').children.length) {
    startChat();
  } else if (chatOpen && chatContext.awaitingReturn) {
    // User returned after being sent to view specs / a section — offer follow-up
    const ret = chatContext.awaitingReturn;
    chatContext.awaitingReturn = null;
    setTimeout(() => offerReturnFollowUp(ret), 350);
  }
}

function offerReturnFollowUp(ret) {
  if (ret.type === 'browse' && ret.model && P[ret.model]) {
    const m = P[ret.model];
    const q = chatState.qual || {};
    const hasModel = !!chatState.model;
    const hasQual = !!q.tier;
    const hasDelivery = !!chatState.incoterm && (chatState.incoterm === 'EXW' || (!!chatState.country && !!chatState.port));

    // STAGE 3: Everything done — qualification + delivery complete → push to quote submission
    if (hasQual && hasDelivery && hasModel) {
      const dest = chatState.incoterm === 'EXW' ? 'Ex Works (Seoul)' : `${chatState.incoterm} ${chatState.port}, ${chatState.country}`;
      chatBotMsg(`Welcome back! You've completed everything we need:\n\n• Model: ${P[chatState.model].model}\n• Delivery: ${dest}\n• Buyer profile: ${q.tier}\n\nShall we move to the quote request page now? Your selections will be pre-filled — you only need to add your contact details.`, () => {
        chatOpts([
          { label: 'Yes — go to quote request', action: () => { chatPrefillAndQuote(); chatEndActions(); }},
          { label: 'Wait, I want to change something', action: () => chatBotMsg("Sure, what would you like to change?", () => {
            chatOpts([
              { label: 'Change model', action: () => chatStep('browse_models') },
              { label: 'Change delivery terms', action: () => chatAskIncoterms() },
              { label: 'Update qualification answers', action: () => chatAskVolume() }
            ]);
          })},
          { label: 'I have one more question first', action: () => { document.getElementById('chatInput').focus(); }}
        ]);
      });
      return;
    }

    const retIsShredder = SHREDDER_IDS.includes(ret.model);
    const compareOpt = retIsShredder ? [{ label: `Compare ${m.model} with another model`, action: () => chatBotMsg(`Pick a model to compare with ${m.model}:`, () => {
      chatOpts(SHREDDER_IDS.filter(id => id !== ret.model).map(id => ({
        label: `vs ${P[id].model}`,
        action: () => chatBotMsg(fmtCompare(ret.model, id) || 'Comparison unavailable.')
      })));
    })}] : [];
    const browseDifferentStep = retIsShredder ? 'browse_models' : (KTECH_IDS.includes(ret.model) ? 'browse_ktech' : 'start');

    // STAGE 2: Qualification done but no delivery (or partial) — continue setup
    if (hasQual && hasModel) {
      chatBotMsg(`Welcome back! You've completed the buyer profile (${q.tier}) for ${P[chatState.model].model}. Let's set up your delivery terms next?`, () => {
        chatOpts([
          { label: 'Continue — set up delivery', action: () => chatAskIncoterms() },
          ...compareOpt,
          { label: 'Browse a different product', action: () => chatStep(browseDifferentStep) },
          { label: 'I have a different question', action: () => { document.getElementById('chatInput').focus(); }}
        ]);
      });
      return;
    }

    // STAGE 1: Just browsed a model (no qualification yet) — first return
    chatBotMsg(`Welcome back! Did you have a chance to review the ${m.model} details? Is there anything I can help you with next?`, () => {
      chatOpts([
        { label: `Yes — request a quote for ${m.model}`, action: () => { chatState.model = ret.model; chatContext.lastModel = ret.model; chatAskQualification(); }},
        ...compareOpt,
        { label: 'Show me a different product', action: () => chatStep(browseDifferentStep) },
        { label: `More about ${m.model}`, action: () => { handleSpec(ret.model); }},
        { label: 'I have a different question', action: () => { document.getElementById('chatInput').focus(); }}
      ]);
    });
  } else if (ret.type === 'section') {
    chatBotMsg(`Welcome back! How can I help you next?`, () => {
      chatOpts([
        { label: 'Browse catalog', action: () => chatStep('start') },
        { label: 'Request a quote', action: () => chatStep('quote_direct') },
        { label: 'About verification process', action: () => chatStep('verify_detail') },
        { label: 'Trade terms', action: () => chatStep('trade_info') }
      ]);
    });
  }
}
function startChat(){
  chatState.model=null; chatState.incoterm=null; chatState.country=null; chatState.port=null;
  chatState.qual = { volume:null, timeline:null, experience:null, payment:null, tier:null };
  // Reset navigation history when the welcome screen is shown from scratch.
  chatContext.navStack = [];
  chatContext.currentStep = null;
  // Hybrid-language intro: when the active UI language is not English, prepend
  // a one-time note explaining why technical content remains in English.
  // Suppress on restartChat() within the same session via chatContext.introShown.
  const lang = document.documentElement.lang || 'en';
  const intro = (CHAT_L[lang] && CHAT_L[lang].intro) || '';
  if (intro && !chatContext.introShown) {
    chatContext.introShown = true;
    chatBotMsg(intro, () => chatStep('start'));
  } else {
    chatStep('start');
  }
}

let chatBotMsgActive = 0;
function chatBotMsg(text, cb) {
  chatBotMsgActive++;
  const body = document.getElementById('chatBody');
  const typing = document.createElement('div');
  typing.className = 'chat-typing';
  typing.innerHTML = '<span></span><span></span><span></span>';
  body.appendChild(typing);
  body.scrollTop = body.scrollHeight;
  setTimeout(()=>{
    typing.remove();
    const m = document.createElement('div'); m.className='chat-msg bot'; m.textContent=text;
    body.appendChild(m); body.scrollTop=body.scrollHeight;
    if(cb) cb();
    chatBotMsgActive--;
    // After all nested messages complete, ensure options exist
    setTimeout(() => {
      if (chatBotMsgActive > 0) return;
      const last = body.lastElementChild;
      if (last && (last.classList.contains('chat-options') || last.classList.contains('chat-typing'))) return;
      chatDefaultOpts();
    }, 1200);
  }, 800);
}

function chatDefaultOpts() {
  const body = document.getElementById('chatBody');
  if (body.lastElementChild && body.lastElementChild.classList.contains('chat-options')) return;
  const div = document.createElement('div');
  div.className = 'chat-options';
  div.style.cssText = 'border-top:1px solid #292929;padding-top:8px;margin-top:6px;';
  const label = document.createElement('span');
  label.style.cssText = 'font-size:10px;color:var(--tx-lt);display:block;margin-bottom:6px;';
  label.textContent = 'What next?';
  div.appendChild(label);
  const opts = [
    { label: 'Browse Models', action: () => handleQuoteChat() },
    { label: cl('quote') + ' →', action: () => chatStep('start') },
    { label: 'Ask Anything', action: () => { div.remove(); document.getElementById('chatInput').focus(); }},
    { label: cl('human'), action: () => showHumanContact() }
  ];
  opts.forEach(o => {
    const b = document.createElement('button');
    b.className = 'chat-opt';
    b.textContent = o.label;
    b.onclick = () => { div.remove(); if (o.label !== 'Ask Anything') chatUserMsg(b.textContent); o.action(); };
    div.appendChild(b);
  });
  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
}
function chatUserMsg(text) {
  const body = document.getElementById('chatBody');
  const m = document.createElement('div'); m.className='chat-msg user'; m.textContent=text; body.appendChild(m); body.scrollTop=body.scrollHeight;
}
function chatOpts(opts) {
  const body = document.getElementById('chatBody');
  const div = document.createElement('div'); div.className='chat-options';
  opts.forEach(o => {
    const b = document.createElement('button'); b.className='chat-opt'; b.textContent=o.label;
    b.onclick = () => { div.remove(); chatUserMsg(o.label); if(o.action) o.action(); };
    div.appendChild(b);
  });
  body.appendChild(div); body.scrollTop=body.scrollHeight;
}
function chatSelect(placeholder, options, onSelect) {
  const body = document.getElementById('chatBody');
  const wrap = document.createElement('div'); wrap.className='chat-options';
  const sel = document.createElement('select'); sel.className='f-sel';
  sel.style.cssText='max-width:260px;font-size:13px;padding:8px 10px;border-radius:8px;';
  sel.innerHTML = `<option value="">${placeholder}</option>` + options.map(o => `<option value="${o}">${o}</option>`).join('');
  const btn = document.createElement('button'); btn.className='chat-opt'; btn.textContent='Confirm'; btn.style.padding='8px 16px';
  btn.onclick = () => { if(!sel.value) return; wrap.remove(); chatUserMsg(sel.value); onSelect(sel.value); };
  wrap.appendChild(sel); wrap.appendChild(btn);
  body.appendChild(wrap); body.scrollTop=body.scrollHeight;
}

// ── BANT Qualification Flow (optional) ──
function chatAskQualification() {
  chatBotMsg("Before we finalize your quote, a few quick questions help us prepare the most accurate pricing and terms for you.\n\n(Takes 20 seconds, or you can skip.)", () => {
    chatOpts([
      { label: 'Continue (4 quick questions)', action: () => chatAskVolume() },
      { label: 'Skip to delivery terms', action: () => chatAskIncoterms() }
    ]);
  });
}
function chatAskVolume() {
  chatBotMsg("1/4 — What's your estimated annual import volume for this product?", () => {
    chatOpts([
      { label: 'Under 20 units', action: () => { chatState.qual.volume='Under 20 units/year'; chatAskTimeline(); }},
      { label: '20–100 units', action: () => { chatState.qual.volume='20–100 units/year'; chatAskTimeline(); }},
      { label: '100+ units', action: () => { chatState.qual.volume='100+ units/year'; chatAskTimeline(); }},
      { label: 'Full container (FCL)', action: () => { chatState.qual.volume='Full container (FCL)'; chatAskTimeline(); }},
      { label: 'Not sure yet', action: () => { chatState.qual.volume='Not determined yet'; chatAskTimeline(); }}
    ]);
  });
}
function chatAskTimeline() {
  chatBotMsg("2/4 — When do you need the shipment to arrive at your port?", () => {
    chatOpts([
      { label: 'Within 4–6 weeks', action: () => { chatState.qual.timeline='Within 4–6 weeks (specific)'; chatAskExperience(); }},
      { label: 'Within 2–3 months', action: () => { chatState.qual.timeline='Within 2–3 months'; chatAskExperience(); }},
      { label: 'Later this year', action: () => { chatState.qual.timeline='Later this year'; chatAskExperience(); }},
      { label: 'Just exploring', action: () => { chatState.qual.timeline='Exploring / No deadline'; chatAskExperience(); }}
    ]);
  });
}
function chatAskExperience() {
  chatBotMsg("3/4 — Have you imported from Korea (or similar products) before? Do you have a current forwarder?", () => {
    chatOpts([
      { label: 'Yes, experienced + forwarder', action: () => { chatState.qual.experience='Experienced importer with forwarder'; chatAskPayment(); }},
      { label: 'Yes, some experience', action: () => { chatState.qual.experience='Some import experience'; chatAskPayment(); }},
      { label: 'No, first time', action: () => { chatState.qual.experience='First-time importer'; chatAskPayment(); }},
      { label: 'Need your guidance', action: () => { chatState.qual.experience='Needs ERGSN guidance'; chatAskPayment(); }}
    ]);
  });
}
function chatAskPayment() {
  chatBotMsg("4/4 — Our standard terms are T/T with 50% advance, 50% before shipment. Does this work for your internal payment process?", () => {
    chatOpts([
      { label: 'Yes, T/T 50/50 works', action: () => { chatState.qual.payment='T/T 50/50 accepted'; chatQualTier(); chatAskIncoterms(); }},
      { label: 'L/C preferred', action: () => { chatState.qual.payment='L/C preferred'; chatQualTier(); chatAskIncoterms(); }},
      { label: 'Need to discuss', action: () => { chatState.qual.payment='Needs discussion'; chatQualTier(); chatAskIncoterms(); }},
      { label: 'Net 60/90 after delivery', action: () => { chatState.qual.payment='Net terms requested (higher risk)'; chatQualTier(); chatAskIncoterms(); }}
    ]);
  });
}

// Calculate buyer tier (A/B/C) for ERGSN's internal prioritization
function chatQualTier() {
  const q = chatState.qual; let score = 0;
  if (/100\+|FCL/.test(q.volume || '')) score += 3;
  else if (/20–100/.test(q.volume || '')) score += 2;
  else if (/Under 20/.test(q.volume || '')) score += 1;
  if (/4–6 weeks|2–3 months/.test(q.timeline || '')) score += 3;
  else if (/Later this year/.test(q.timeline || '')) score += 1;
  if (/Experienced|Some import/.test(q.experience || '')) score += 2;
  else if (/First-time|Needs ERGSN/.test(q.experience || '')) score += 1;
  if (/accepted|L\/C/.test(q.payment || '')) score += 3;
  else if (/Needs discussion/.test(q.payment || '')) score += 1;
  q.tier = score >= 9 ? 'A (Hot Lead)' : score >= 6 ? 'B (Warm Lead)' : 'C (Early Stage)';
}

function chatAskIncoterms() {
  chatBotMsg("Now let's set up delivery. What Incoterms do you prefer?", () => {
    chatOpts([
      { label: 'FOB', action: () => { chatState.incoterm='FOB'; chatAskCountry(); }},
      { label: 'CIF', action: () => { chatState.incoterm='CIF'; chatAskCountry(); }},
      { label: 'CFR', action: () => { chatState.incoterm='CFR'; chatAskCountry(); }},
      { label: 'EXW', action: () => { chatState.incoterm='EXW'; chatFinalize(); }},
      { label: 'Other', action: () => { chatState.incoterm='Other'; chatAskCountry(); }}
    ]);
  });
}
function chatAskCountry() {
  chatBotMsg("Which country should we ship to?", () => {
    chatSelect('Select country\u2026', Object.keys(WORLD_PORTS).filter(k => k !== 'Other'), (val) => {
      chatState.country = val;
      const ports = WORLD_PORTS[val];
      if (typeof ports === 'string' || !ports || ports.length <= 1) { chatState.port = typeof ports === 'string' ? ports : (ports ? ports[0] : val); chatFinalize(); }
      else chatAskPort(ports);
    });
  });
}
function chatAskPort(ports) {
  chatBotMsg(`Which port in ${chatState.country}?`, () => {
    chatSelect('Select port\u2026', ports, (val) => { chatState.port = val; chatFinalize(); });
  });
}
function chatFinalize() {
  const m = P[chatState.model];
  const dest = chatState.incoterm === 'EXW' ? 'Ex Works (Seoul)' : `${chatState.incoterm} ${chatState.port}, ${chatState.country}`;
  chatBotMsg(`Perfect! ${m.model} \u2014 ${dest}. Ready to request a quote?`, () => {
    chatOpts([
      { label: 'Request Quote', action: () => { chatPrefillAndQuote(); chatEndActions(); }},
      { label: `View ${m.model} Specs`, action: () => { chatContext.awaitingReturn = { type:'browse', model: chatState.model }; toggleChat(); openModal(chatState.model); chatEndActions(); }},
    ]);
  });
}
function chatEndActions() {
  const body = document.getElementById('chatBody');
  setTimeout(() => {
    const div = document.createElement('div');
    div.className = 'chat-options';
    div.style.cssText = 'border-top:1px solid #292929;padding-top:12px;margin-top:8px;';
    div.innerHTML = '<button class="chat-opt" onclick="clearChat()" style="opacity:.7">Clear Chat</button><button class="chat-opt" onclick="restartChat()">New Question</button>';
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
  }, 600);
}
function clearChat() {
  document.getElementById('chatBody').innerHTML = '';
  startChat();
}

let chatLocked = null;

function applyQuoteFields() {
  const cb = document.getElementById('m' + chatState.model.toUpperCase());
  if (cb) cb.checked = true;

  const incoEl = document.getElementById('fIncoterms');
  if (incoEl && chatState.incoterm && chatState.incoterm !== 'Other') {
    const ph = incoEl.querySelector('option[disabled]');
    if (ph) ph.disabled = false;
    incoEl.value = chatState.incoterm;
    onIncotermsChange();
  }

  const countryEl = document.getElementById('fCountry');
  if (countryEl && chatState.country) {
    const ph = countryEl.querySelector('option[disabled]');
    if (ph) ph.disabled = false;
    countryEl.value = chatState.country;
    onCountryChange();
    if (chatState.port) {
      const portEl = document.getElementById('fPort');
      if (portEl) {
        const ph2 = portEl.querySelector('option[disabled]');
        if (ph2) ph2.disabled = false;
        portEl.value = chatState.port;
      }
    }
  }

  chatLocked = {
    incoterm: chatState.incoterm,
    country: chatState.country,
    port: chatState.port
  };
}

// Guard: block browser autofill from overwriting chatbot values
// User click (pointerdown) = intentional change → unlock
// No click before change = autofill → revert
(function initFieldGuards(){
  ['fIncoterms','fCountry','fPort'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    let userClicked = false;
    el.addEventListener('pointerdown', () => { userClicked = true; });
    el.addEventListener('mousedown', () => { userClicked = true; });
    el.addEventListener('change', () => {
      if (chatLocked && !userClicked) {
        if (id === 'fIncoterms') { el.value = chatLocked.incoterm; onIncotermsChange(); }
        if (id === 'fCountry') {
          el.value = chatLocked.country;
          onCountryChange();
          const portEl = document.getElementById('fPort');
          if (portEl && chatLocked.port) portEl.value = chatLocked.port;
        }
        if (id === 'fPort') { el.value = chatLocked.port; }
      } else if (userClicked) {
        chatLocked = null;
      }
      userClicked = false;
    });
  });
})();

function chatPrefillAndQuote() {
  resetRFQForm();
  toggleChat();
  setTimeout(() => {
    document.getElementById('rfq').scrollIntoView({ behavior: 'smooth' });
    setTimeout(applyQuoteFields, 500);
  }, 150);
}

/* Chat node resolver — allows per-language overrides.
 * To localize the chatbot, add to translations.js under each lang:
 *   chat: { start: { msg: '...', opts: [{label: '...', next: 'find_office_size'}, ...] }, ... }
 * Keys mirror CHAT_TREE's top-level node names (start, find_office_size, browse_models, etc.).
 * Missing keys fall back to the English CHAT_TREE entry. */
function getChatNode(key) {
  const lang = document.documentElement.lang || 'en';
  const overlay = (typeof T !== 'undefined' && T[lang] && T[lang].chat && T[lang].chat[key]) || null;
  const base = CHAT_TREE[key];
  if (!base) return null;
  if (!overlay) return base;
  return {
    ...base,
    msg: overlay.msg || base.msg,
    opts: (overlay.opts && overlay.opts.length) ? overlay.opts : base.opts
  };
}
function chatStep(key, opts){
  opts = opts || {};
  // Track breadcrumbs so a universal "\u2190 Back" button can pop back one level.
  // Forward moves push the page we're leaving; an isBack call skips that push.
  if (!opts.isBack && chatContext.currentStep && chatContext.currentStep !== key) {
    const top = chatContext.navStack[chatContext.navStack.length - 1];
    if (top !== chatContext.currentStep) chatContext.navStack.push(chatContext.currentStep);
  }
  // Reaching the welcome screen again clears the trail — no one expects
  // "Back" from home to pop to an older home visit.
  if (key === 'start') chatContext.navStack = [];
  chatContext.currentStep = key;
  const node = getChatNode(key);
  const body = document.getElementById('chatBody');
  const typing = document.createElement('div');
  typing.className = 'chat-typing';
  typing.innerHTML = '<span></span><span></span><span></span>';
  body.appendChild(typing);
  body.scrollTop = body.scrollHeight;
  setTimeout(()=>{
    typing.remove();
    const msg = document.createElement('div');
    msg.className = 'chat-msg bot';
    msg.textContent = node.msg;
    body.appendChild(msg);
    if(node.rec){
      chatState.model = node.rec;
      const m = P[node.rec];
      const recDiv = document.createElement('div');
      recDiv.className = 'chat-options';
      recDiv.innerHTML = `<button class="chat-opt" onclick="chatAskIncoterms()">Set Up Quote \u2192</button><button class="chat-opt" onclick="toggleChat();openModal('${node.rec}')">View ${m.model} Specs</button><button class="chat-opt" onclick="restartChat()">Start Over</button>`;
      body.appendChild(recDiv);
    } else if(node.opts.length){
      const optDiv = document.createElement('div');
      optDiv.className = 'chat-options';
      node.opts.forEach(o=>{
        const btn = document.createElement('button');
        btn.className = 'chat-opt';
        btn.textContent = o.label;
        btn.onclick = ()=>{
          optDiv.remove();
          const userMsg = document.createElement('div');
          userMsg.className = 'chat-msg user';
          userMsg.textContent = o.label;
          body.appendChild(userMsg);
          body.scrollTop = body.scrollHeight;
          if (o.action && typeof o.action === 'string') {
            // Handle string action commands
            if (o.action.startsWith('browse_')) {
              const id = o.action.replace('browse_', '');
              chatContext.lastModel = id;
              chatContext.awaitingReturn = { type: 'browse', model: id };
              setTimeout(() => { toggleChat(); openModal(id); }, 200);
            } else if (o.action.startsWith('quote_')) {
              const id = o.action.replace('quote_', '');
              chatState.model = id;
              chatContext.lastModel = id;
              chatAskQualification();
            }
          } else if (o.next) {
            chatStep(o.next);
          }
        };
        optDiv.appendChild(btn);
      });
      // Auto-inject "\u2190 Back" to pop the breadcrumb when the user is
      // deeper than the welcome screen.
      if (chatContext.navStack.length) {
        const backBtn = document.createElement('button');
        backBtn.className = 'chat-opt chat-opt-back';
        backBtn.textContent = '\u2190 Back';
        backBtn.onclick = () => { optDiv.remove(); chatBack(); };
        optDiv.appendChild(backBtn);
      }
      body.appendChild(optDiv);
    }
    // Initial welcome should land at the top so the greeting is read from
    // the first line. Everywhere else, pin to the newest message.
    const isInitialWelcome = key === 'start' && !body.querySelector('.chat-msg.user');
    body.scrollTop = isInitialWelcome ? 0 : body.scrollHeight;
  }, 800);
}
function chatBack(){
  if (!chatContext.navStack.length) return;
  const prev = chatContext.navStack.pop();
  const body = document.getElementById('chatBody');
  const userMsg = document.createElement('div');
  userMsg.className = 'chat-msg user';
  userMsg.textContent = '\u2190 Back';
  body.appendChild(userMsg);
  body.scrollTop = body.scrollHeight;
  chatStep(prev, { isBack: true });
}
function restartChat(){
  document.getElementById('chatBody').innerHTML = '';
  startChat();
}

