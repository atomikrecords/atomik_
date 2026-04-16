-- 🎬 CINEMATIC CAMERA BUILDER PLUGIN v5
-- Install: Plugins folder → %LOCALAPPDATA%\Roblox\Plugins\ (Windows)
--                         → ~/Documents/Roblox/Plugins/ (Mac)
-- Then restart Roblox Studio.

local UIS = game:GetService("UserInputService")
local TS  = game:GetService("TweenService")
local SEL = game:GetService("Selection")
local SS  = game:GetService("ServerStorage")

-- ── TOOLBAR ──────────────────────────────────────────────────────────────────
local toolbar = plugin:CreateToolbar("🎬 Cinematic Cam")
local openBtn = toolbar:CreateButton("Open Panel","Cinematic Camera Builder","rbxassetid://6031068421")

local widget = plugin:CreateDockWidgetPluginGui("CinCam_v5",
	DockWidgetPluginGuiInfo.new(Enum.InitialDockState.Right, true, false, 300, 700, 240, 400))
widget.Title   = "🎬 Cinematic Camera Builder"
widget.Enabled = false
openBtn.Click:Connect(function() widget.Enabled = not widget.Enabled end)

-- ── PALETTE ──────────────────────────────────────────────────────────────────
local C = {
	bg      = Color3.fromRGB(22,22,30),
	panel   = Color3.fromRGB(34,34,46),
	accent  = Color3.fromRGB(99,102,241),
	accentH = Color3.fromRGB(130,133,255),
	txt     = Color3.fromRGB(228,228,240),
	sub     = Color3.fromRGB(138,138,162),
	border  = Color3.fromRGB(50,50,66),
	red     = Color3.fromRGB(220,65,65),
	green   = Color3.fromRGB(52,199,110),
	yellow  = Color3.fromRGB(255,190,40),
	blue    = Color3.fromRGB(55,130,200),
	offgrey = Color3.fromRGB(78,78,100),
}

-- ── TINY UI HELPERS ───────────────────────────────────────────────────────────
local function rnd(p,r)  local c=Instance.new("UICorner") c.CornerRadius=UDim.new(0,r or 8) c.Parent=p end
local function bdr(p,col,t) local s=Instance.new("UIStroke") s.Color=col or C.border s.Thickness=t or 1 s.Parent=p end
local function inset(p,l,r,t,b)
	local u=Instance.new("UIPadding")
	u.PaddingLeft=UDim.new(0,l or 0) u.PaddingRight=UDim.new(0,r or 0)
	u.PaddingTop=UDim.new(0,t or 0)  u.PaddingBottom=UDim.new(0,b or 0)
	u.Parent=p
end
local function vstack(p,gap)
	local l=Instance.new("UIListLayout")
	l.SortOrder=Enum.SortOrder.LayoutOrder l.Padding=UDim.new(0,gap or 8) l.Parent=p return l
end
local function hstack(p,gap,va)
	local l=Instance.new("UIListLayout")
	l.FillDirection=Enum.FillDirection.Horizontal
	l.SortOrder=Enum.SortOrder.LayoutOrder
	l.VerticalAlignment=va or Enum.VerticalAlignment.Center
	l.Padding=UDim.new(0,gap or 6) l.Parent=p return l
end

-- Fixed-size label (no AutomaticSize — caller sets Size)
local function txt(parent,text,size,color,bold)
	local l=Instance.new("TextLabel")
	l.Text=text l.TextSize=size or 12
	l.Font=bold and Enum.Font.GothamBold or Enum.Font.Gotham
	l.TextColor3=color or C.txt l.BackgroundTransparency=1
	l.TextXAlignment=Enum.TextXAlignment.Left
	l.TextWrapped=false l.TextTruncate=Enum.TextTruncate.AtEnd
	l.Parent=parent return l
end

-- Full-width button with fixed height; caller sets LayoutOrder & Size
local function btn(parent,label,color,tsize)
	local b=Instance.new("TextButton")
	b.Text=label b.TextSize=tsize or 13 b.Font=Enum.Font.GothamBold
	b.TextColor3=Color3.new(1,1,1) b.BackgroundColor3=color or C.accent
	b.AutoButtonColor=false b.TextXAlignment=Enum.TextXAlignment.Center
	b.TextTruncate=Enum.TextTruncate.AtEnd b.Parent=parent rnd(b,7)
	b.MouseEnter:Connect(function() b.BackgroundColor3=(color or C.accent):Lerp(Color3.new(1,1,1),.18) end)
	b.MouseLeave:Connect(function() b.BackgroundColor3=color or C.accent end)
	return b
end

-- ── ROOT SCROLL (created before everything else) ──────────────────────────────
local scroll=Instance.new("ScrollingFrame")
scroll.Size=UDim2.new(1,0,1,0)
scroll.BackgroundColor3=C.bg scroll.BorderSizePixel=0
scroll.ScrollBarThickness=4 scroll.ScrollBarImageColor3=C.accent
scroll.AutomaticCanvasSize=Enum.AutomaticSize.Y
scroll.CanvasSize=UDim2.new(0,0,0,0)
scroll.Parent=widget
vstack(scroll,10)
inset(scroll,12,12,12,16)

-- ── SECTION CARD factory (scroll must exist first) ────────────────────────────
-- Uses a fixed height so nothing collapses. Children are absolutely positioned.
local function section(order, h)
	local f=Instance.new("Frame")
	f.BackgroundColor3=C.panel f.Size=UDim2.new(1,0,0,h)
	f.LayoutOrder=order f.Parent=scroll
	rnd(f,10) bdr(f) inset(f,12,12,10,10)
	return f
end

-- ── HEADER ───────────────────────────────────────────────────────────────────
do
	local h=Instance.new("Frame")
	h.Size=UDim2.new(1,0,0,58) h.BackgroundColor3=C.accent h.LayoutOrder=1 h.Parent=scroll rnd(h,10)
	local g=Instance.new("UIGradient")
	g.Color=ColorSequence.new{ColorSequenceKeypoint.new(0,Color3.fromRGB(99,102,241)),ColorSequenceKeypoint.new(1,Color3.fromRGB(160,100,255))}
	g.Rotation=90 g.Parent=h
	local t1=txt(h,"🎬 Cinematic Camera Builder",14,Color3.new(1,1,1),true)
	t1.Size=UDim2.new(1,-16,0,20) t1.Position=UDim2.new(0,12,0,9)
	local t2=txt(h,"Build smooth loading screen sequences",10,Color3.fromRGB(210,210,255))
	t2.Size=UDim2.new(1,-16,0,15) t2.Position=UDim2.new(0,12,0,33)
end

-- ── SETTINGS SECTION ─────────────────────────────────────────────────────────
-- Heights: title=20, 3×slider=44, easing label+2rows=76  + padding = ~246
local SETT_H = 252
local sett = section(2, SETT_H)

do local t=txt(sett,"⚙️ Settings",13,C.txt,true) t.Size=UDim2.new(1,0,0,18) t.Position=UDim2.new(0,0,0,0) end

-- Slider: yOff = top of the slider block inside sett
local selEasing = "Sine"
local eBtns = {}
local getTD, getWT, getDist

do
	local function makeSlider(yOff, label, mn, mx, def, isFloat)
		-- label row
		local lbL=txt(sett, label, 11, C.sub)
		lbL.Size=UDim2.new(1,-44,0,14) lbL.Position=UDim2.new(0,0,0,yOff)

		local valL=txt(sett, isFloat and string.format("%.1f",def) or tostring(def), 11, C.accent, true)
		valL.Size=UDim2.new(0,40,0,14) valL.Position=UDim2.new(1,-40,0,yOff)
		valL.TextXAlignment=Enum.TextXAlignment.Right

		-- track
		local track=Instance.new("Frame")
		track.Size=UDim2.new(1,0,0,6) track.Position=UDim2.new(0,0,0,yOff+18)
		track.BackgroundColor3=C.border track.Parent=sett rnd(track,4)

		local fill=Instance.new("Frame")
		fill.BackgroundColor3=C.accent fill.Size=UDim2.new(0,0,1,0) fill.Parent=track rnd(fill,4)

		local thumb=Instance.new("TextButton")
		thumb.Size=UDim2.new(0,14,0,14) thumb.BackgroundColor3=Color3.new(1,1,1)
		thumb.Text="" thumb.AutoButtonColor=false thumb.ZIndex=3 thumb.Parent=track
		rnd(thumb,8) bdr(thumb,C.border,1)

		local cur=def
		local function upd(x)
			local tp=track.AbsolutePosition.X local ts=track.AbsoluteSize.X
			if ts<=0 then return end
			local r=math.clamp((x-tp)/ts,0,1)
			cur = isFloat and math.floor((mn+r*(mx-mn))*10+.5)/10 or math.floor(mn+r*(mx-mn)+.5)
			valL.Text = isFloat and string.format("%.1f",cur) or tostring(cur)
			fill.Size=UDim2.new(r,0,1,0) thumb.Position=UDim2.new(r,-7,0.5,-7)
		end
		local ir=(def-mn)/(mx-mn)
		fill.Size=UDim2.new(ir,0,1,0) thumb.Position=UDim2.new(ir,-7,0.5,-7)

		local drag=false
		thumb.MouseButton1Down:Connect(function() drag=true end)
		UIS.InputChanged:Connect(function(i)
			if drag and i.UserInputType==Enum.UserInputType.MouseMovement then upd(i.Position.X) end
		end)
		UIS.InputEnded:Connect(function(i)
			if i.UserInputType==Enum.UserInputType.MouseButton1 then drag=false end
		end)
		track.InputBegan:Connect(function(i)
			if i.UserInputType==Enum.UserInputType.MouseButton1 then upd(i.Position.X) end
		end)
		return function() return cur end
	end

	-- 3 sliders stacked; each block is 36px tall (14 label + 4 gap + 6 track + 12 margin)
	getTD   = makeSlider(24,  "Tween Duration (sec)",      0.5, 15, 3,   true)
	getWT   = makeSlider(70,  "Pause at each point (sec)", 0,   5,  1,   true)
	getDist = makeSlider(116, "Spawn distance (studs)",    2,   30, 6,   false)
end

-- Easing buttons: label at y=162, two rows below
do
	local el=txt(sett,"Easing Style",11,C.sub)
	el.Size=UDim2.new(1,0,0,14) el.Position=UDim2.new(0,0,0,162)

	local styles={"Linear","Sine","Quad","Cubic","Bounce","Elastic"}

	-- row1 at y=180, row2 at y=210
	for i,style in ipairs(styles) do
		local col = i<=3 and 0 or 1   -- column 0..2
		local row = i<=3 and 0 or 1   -- row
		local slot = (i-1)%3          -- 0,1,2

		local b=Instance.new("TextButton")
		b.Text=style b.TextSize=11 b.Font=Enum.Font.GothamBold
		b.BackgroundColor3=style==selEasing and C.accent or C.border
		b.TextColor3=Color3.new(1,1,1) b.AutoButtonColor=false
		-- 3 equal-width buttons per row with 4px gaps
		-- width = (1/3) scale - offset to account for 2 gaps of 4px across 3 cells
		b.Size=UDim2.new(1/3,-3,0,24)
		b.Position=UDim2.new(slot/3, slot==0 and 0 or slot*4-4+2, 0, 180+row*30)
		b.Parent=sett rnd(b,5)
		eBtns[style]=b
		b.MouseButton1Click:Connect(function()
			selEasing=style
			for s,bb in pairs(eBtns) do bb.BackgroundColor3=s==style and C.accent or C.border end
		end)
	end
end

-- ── VISIBILITY SECTION ───────────────────────────────────────────────────────
local pointsVisible = true
local toggleFrame, toggleThumb, visLabel
do
	local vis = section(3, 44)
	visLabel=txt(vis,"👁  Camera Points Visible",12,C.txt,true)
	visLabel.Size=UDim2.new(1,-54,0,18) visLabel.Position=UDim2.new(0,0,0.5,-9)

	toggleFrame=Instance.new("Frame")
	toggleFrame.Size=UDim2.new(0,44,0,24) toggleFrame.Position=UDim2.new(1,-44,0.5,-12)
	toggleFrame.BackgroundColor3=C.green toggleFrame.Parent=vis rnd(toggleFrame,12)

	toggleThumb=Instance.new("Frame")
	toggleThumb.Size=UDim2.new(0,18,0,18) toggleThumb.Position=UDim2.new(1,-21,0.5,-9)
	toggleThumb.BackgroundColor3=Color3.new(1,1,1) toggleThumb.Parent=toggleFrame rnd(toggleThumb,10)

	local hit=Instance.new("TextButton")
	hit.Size=UDim2.new(1,0,1,0) hit.BackgroundTransparency=1 hit.Text="" hit.Parent=toggleFrame
	hit.MouseButton1Click:Connect(function()
		pointsVisible=not pointsVisible
		if pointsVisible then
			toggleFrame.BackgroundColor3=C.green toggleThumb.Position=UDim2.new(1,-21,0.5,-9)
			visLabel.Text="👁  Camera Points Visible"
		else
			toggleFrame.BackgroundColor3=C.offgrey toggleThumb.Position=UDim2.new(0,3,0.5,-9)
			visLabel.Text="🙈  Camera Points Hidden"
		end
		for _,d in ipairs(_G._camPts or {}) do
			d.body.Transparency  = pointsVisible and 0 or 1
			d.shaft.Transparency = pointsVisible and 0 or 1
			d.tip.Transparency   = pointsVisible and 0 or 1
			d.sel.Visible        = pointsVisible
			d.bb.Enabled         = pointsVisible
		end
	end)
end

-- ── POINTS HEADER SECTION ─────────────────────────────────────────────────────
local ptitle
do
	local ph=section(4,38)
	ptitle=txt(ph,"📍 Camera Points  (0)",13,C.txt,true)
	ptitle.Size=UDim2.new(1,0,0,18) ptitle.Position=UDim2.new(0,0,0.5,-9)
end

-- ── ADD BUTTON ───────────────────────────────────────────────────────────────
local addBtn=btn(scroll,"+  Add Camera Point",C.green,13)
addBtn.Size=UDim2.new(1,0,0,38) addBtn.LayoutOrder=5

-- ── POINT LIST ───────────────────────────────────────────────────────────────
local listFrame=Instance.new("Frame")
listFrame.Size=UDim2.new(1,0,0,0) listFrame.AutomaticSize=Enum.AutomaticSize.Y
listFrame.BackgroundTransparency=1 listFrame.LayoutOrder=6 listFrame.Parent=scroll
vstack(listFrame,6)

-- ── ACTION BUTTONS ────────────────────────────────────────────────────────────
local prevBtn=btn(scroll,"▶  Preview Sequence",C.accent,13)
prevBtn.Size=UDim2.new(1,0,0,38) prevBtn.LayoutOrder=7

local genBtn=btn(scroll,"📋  Generate Script to ServerStorage",C.blue,12)
genBtn.Size=UDim2.new(1,0,0,38) genBtn.LayoutOrder=8

local clearBtn=btn(scroll,"🗑  Clear All Points",C.red,13)
clearBtn.Size=UDim2.new(1,0,0,38) clearBtn.LayoutOrder=9

-- ── STATUS SECTION ────────────────────────────────────────────────────────────
local statusL
do
	local sf=section(10,42)
	statusL=Instance.new("TextLabel")
	statusL.Text="💡 Add camera points and position them in your scene!"
	statusL.TextSize=11 statusL.Font=Enum.Font.Gotham statusL.TextColor3=C.sub
	statusL.BackgroundTransparency=1 statusL.TextXAlignment=Enum.TextXAlignment.Left
	statusL.TextWrapped=true statusL.Size=UDim2.new(1,0,1,0)
	statusL.Position=UDim2.new(0,0,0,0)
	statusL.Parent=sf
end
local function setStatus(msg,col) statusL.Text=msg statusL.TextColor3=col or C.sub end

-- ── WORLD PARTS ───────────────────────────────────────────────────────────────
_G._camPts = {}
local camPoints = _G._camPts

local function getFolder()
	return workspace:FindFirstChild("CinematicPoints")
		or (function() local f=Instance.new("Folder") f.Name="CinematicPoints" f.Parent=workspace return f end)()
end

local function spawnPart(idx)
	local folder=getFolder()
	local cam=workspace.CurrentCamera
	local spawnCF=cam.CFrame*CFrame.new(0,0,-getDist())

	local body=Instance.new("Part")
	body.Name="CamPoint_"..idx body.Size=Vector3.new(2.4,1.4,1)
	body.CFrame=spawnCF body.Anchored=true body.CanCollide=false
	body.Material=Enum.Material.Neon body.Color=Color3.fromRGB(99,102,241)
	body.CastShadow=false body.Parent=folder

	local shaft=Instance.new("Part")
	shaft.Name="Shaft" shaft.Size=Vector3.new(.25,.25,2.5)
	shaft.CFrame=spawnCF*CFrame.new(0,0,-1.5) shaft.Anchored=true shaft.CanCollide=false
	shaft.Material=Enum.Material.Neon shaft.Color=Color3.fromRGB(99,102,241)
	shaft.CastShadow=false shaft.Parent=folder
	do local w=Instance.new("WeldConstraint") w.Part0=body w.Part1=shaft w.Parent=body end

	local tip=Instance.new("Part")
	tip.Name="Tip" tip.Size=Vector3.new(.8,.8,1.2)
	tip.CFrame=spawnCF*CFrame.new(0,0,-3.2) tip.Anchored=true tip.CanCollide=false
	tip.Material=Enum.Material.Neon tip.Color=Color3.fromRGB(255,190,40)
	tip.CastShadow=false tip.Parent=folder
	do local w=Instance.new("WeldConstraint") w.Part0=body w.Part1=tip w.Parent=body end

	local bb=Instance.new("BillboardGui")
	bb.Size=UDim2.new(0,48,0,48) bb.StudsOffset=Vector3.new(0,1.8,0)
	bb.AlwaysOnTop=true bb.Parent=body
	do
		local n=Instance.new("TextLabel")
		n.Size=UDim2.new(1,0,1,0) n.BackgroundColor3=Color3.fromRGB(99,102,241)
		n.TextColor3=Color3.new(1,1,1) n.Text=tostring(idx)
		n.TextScaled=true n.Font=Enum.Font.GothamBold n.Parent=bb
		rnd(n,8)
	end

	local sel=Instance.new("SelectionBox")
	sel.Adornee=body sel.Color3=Color3.fromRGB(99,102,241)
	sel.LineThickness=0.03 sel.SurfaceTransparency=0.85
	sel.SurfaceColor3=Color3.fromRGB(99,102,241) sel.Parent=folder

	local d={body=body,shaft=shaft,tip=tip,sel=sel,bb=bb}

	-- apply current visibility
	local t=pointsVisible and 0 or 1
	body.Transparency=t shaft.Transparency=t tip.Transparency=t
	sel.Visible=pointsVisible bb.Enabled=pointsVisible

	return d
end

local function killPt(d)
	for _,k in ipairs({"body","shaft","tip","sel","bb"}) do
		if d[k] and d[k].Parent then d[k]:Destroy() end
	end
end

local function rebuildList()
	for _,c in ipairs(listFrame:GetChildren()) do if c:IsA("Frame") then c:Destroy() end end
	ptitle.Text="📍 Camera Points  ("..#camPoints..")"

	for i,d in ipairs(camPoints) do
		local row=Instance.new("Frame")
		row.BackgroundColor3=C.panel row.Size=UDim2.new(1,0,0,38)
		row.LayoutOrder=i row.Parent=listFrame rnd(row,8) bdr(row)

		-- badge
		local badge=Instance.new("TextLabel")
		badge.Size=UDim2.new(0,24,0,24) badge.Position=UDim2.new(0,8,0.5,-12)
		badge.BackgroundColor3=C.accent badge.Text=tostring(i)
		badge.TextColor3=Color3.new(1,1,1) badge.TextSize=11 badge.Font=Enum.Font.GothamBold
		badge.Parent=row rnd(badge,6)

		-- delete (far right)
		local del=btn(row,"✕",C.red,12)
		del.Size=UDim2.new(0,26,0,26) del.Position=UDim2.new(1,-34,0.5,-13)
		local di=i
		del.MouseButton1Click:Connect(function()
			killPt(camPoints[di]) table.remove(camPoints,di)
			rebuildList() setStatus("Removed Point "..di..".",C.red)
		end)

		-- go button
		local go=btn(row,"📍 Go",C.blue,10)
		go.Size=UDim2.new(0,44,0,26) go.Position=UDim2.new(1,-84,0.5,-13)
		local ii=i
		go.MouseButton1Click:Connect(function()
			SEL:Set({camPoints[ii].body})
			setStatus("Selected Point "..ii.." — move & rotate it!",C.accent)
		end)

		-- name (fills middle)
		local nm=txt(row,"CamPoint_"..i,11,C.txt)
		nm.Position=UDim2.new(0,40,0.5,-8) nm.Size=UDim2.new(1,-132,0,16)
	end
end

-- ── BUTTON LOGIC ──────────────────────────────────────────────────────────────
addBtn.MouseButton1Click:Connect(function()
	local idx=#camPoints+1
	local d=spawnPart(idx)
	table.insert(camPoints,d)
	SEL:Set({d.body})
	rebuildList()
	setStatus("✅ Point "..idx.." added! Move & rotate the arrow in the viewport.",C.green)
end)

clearBtn.MouseButton1Click:Connect(function()
	for _,d in ipairs(camPoints) do killPt(d) end
	camPoints={}
	local f=workspace:FindFirstChild("CinematicPoints") if f then f:Destroy() end
	rebuildList()
	setStatus("🗑 All points cleared.",C.red)
end)

local previewing=false
prevBtn.MouseButton1Click:Connect(function()
	if #camPoints<2 then setStatus("⚠️ Need at least 2 points!",C.yellow) return end
	if previewing then return end
	previewing=true prevBtn.Text="⏹ Previewing..." prevBtn.BackgroundColor3=C.red

	local cam=workspace.CurrentCamera
	local origType=cam.CameraType
	cam.CameraType=Enum.CameraType.Scriptable

	local eMap={Linear=Enum.EasingStyle.Linear,Sine=Enum.EasingStyle.Sine,
		Quad=Enum.EasingStyle.Quad,Cubic=Enum.EasingStyle.Cubic,
		Bounce=Enum.EasingStyle.Bounce,Elastic=Enum.EasingStyle.Elastic}
	local es=eMap[selEasing] or Enum.EasingStyle.Sine
	local td=getTD() local wd=getWT()

	local fb=camPoints[1].body
	cam.CFrame=CFrame.new(fb.Position,fb.Position+fb.CFrame.LookVector*10)
	task.wait(wd)
	for i=2,#camPoints do
		local pb=camPoints[i].body
		local tw=TS:Create(cam,TweenInfo.new(td,es,Enum.EasingDirection.InOut),
			{CFrame=CFrame.new(pb.Position,pb.Position+pb.CFrame.LookVector*10)})
		tw:Play() tw.Completed:Wait() task.wait(wd)
	end

	cam.CameraType=origType
	previewing=false prevBtn.Text="▶  Preview Sequence" prevBtn.BackgroundColor3=C.accent
	setStatus("✅ Preview complete! Camera returned to normal.",C.green)
end)

genBtn.MouseButton1Click:Connect(function()
	if #camPoints<2 then setStatus("⚠️ Add at least 2 points first!",C.yellow) return end
	local td=getTD() local wd=getWT()
	local lines={
		"--[[ 🎬 CINEMATIC CAMERA SCRIPT",
		"     Generated by Cinematic Camera Builder Plugin",
		"     Place as a LocalScript in StarterGui or StarterPlayerScripts",
		"--]]","",
		'local TweenService = game:GetService("TweenService")',
		'local cam = workspace.CurrentCamera',"",
		"local originalCameraType = cam.CameraType",
		'cam.CameraType = Enum.CameraType.Scriptable',"",
		"local waypoints = {",
	}
	for i,d in ipairs(camPoints) do
		local p=d.body.Position local lv=d.body.CFrame.LookVector local lp=p+lv*10
		lines[#lines+1]=string.format(
			"  {pos=Vector3.new(%.2f,%.2f,%.2f),look=Vector3.new(%.2f,%.2f,%.2f)}, -- Point %d",
			p.X,p.Y,p.Z,lp.X,lp.Y,lp.Z,i)
	end
	lines[#lines+1]="}"
	lines[#lines+1]=""
	lines[#lines+1]=string.format("local TWEEN_DURATION = %.1f",td)
	lines[#lines+1]=string.format("local PAUSE_DURATION = %.1f",wd)
	lines[#lines+1]=string.format("local EASING = Enum.EasingStyle.%s",selEasing)
	lines[#lines+1]=""
	lines[#lines+1]="cam.CFrame = CFrame.new(waypoints[1].pos, waypoints[1].look)"
	lines[#lines+1]="task.wait(PAUSE_DURATION)"
	lines[#lines+1]=""
	lines[#lines+1]="for i = 2, #waypoints do"
	lines[#lines+1]="  local targetCF = CFrame.new(waypoints[i].pos, waypoints[i].look)"
	lines[#lines+1]="  local tween = TweenService:Create(cam,"
	lines[#lines+1]="    TweenInfo.new(TWEEN_DURATION, EASING, Enum.EasingDirection.InOut),"
	lines[#lines+1]="    {CFrame=targetCF})"
	lines[#lines+1]="  tween:Play()"
	lines[#lines+1]="  tween.Completed:Wait()"
	lines[#lines+1]="  task.wait(PAUSE_DURATION)"
	lines[#lines+1]="end"
	lines[#lines+1]=""
	lines[#lines+1]="-- Restore player camera"
	lines[#lines+1]="cam.CameraType = originalCameraType"

	local old=SS:FindFirstChild("CinematicCameraScript") if old then old:Destroy() end
	local sv=Instance.new("LocalScript")
	sv.Name="CinematicCameraScript" sv.Source=table.concat(lines,"\n") sv.Parent=SS
	setStatus("✅ Script saved! Move ServerStorage > CinematicCameraScript into StarterGui.",C.green)
end)

print("✅ Cinematic Camera Builder v5 loaded!")
