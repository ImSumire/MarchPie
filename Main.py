from math import cos, sin, radians, degrees, pi
import moderngl_window as mglw


K_c = 99
K_d = 100
K_q = 113
K_s = 115
K_z = 122

K_LEFT = 65361
K_UP = 65362
K_RIGHT = 65363
K_DOWN = 65364

K_SPACE = 32
K_LSHIFT = 65505

K_LCTRL = 65507

class Camera:
    def __init__(self, x=0.0, y=0.0, z=-2.0):
        self.x = x
        self.y = y
        self.z = z
        
        self.speed = 0.04

        self.lat = 0.0
        self.lon = 0.0

        self.lat_speed = 0.012
        self.lon_speed = 0.008


class App(mglw.WindowConfig):
    window_size = 1280, 720
    resource_dir = "Shaders"
    title = "Ray Marching"
    resizable = False
    vsync = False  # True : ~60fps  |  False : ~280fps

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.quad = mglw.geometry.quad_fs()
        self.prog = self.load_program(
            vertex_shader="main.vert",
            fragment_shader="raymarching.frag"
        )
        self.non_used_uniforms = []
        self.set_uniform("u_resolution", self.window_size)
        self.keys_pressed = set()

    def set_uniform(self, u_name, u_value):
        if u_name not in self.non_used_uniforms:
            try:
                self.prog[u_name] = u_value
            except KeyError:
                print(f"uniform: {u_name} is not used in shader")
                self.non_used_uniforms.append(u_name)

    def render(self, time, frame_time):
        cam.speed = (0.04, 0.12)[K_LCTRL in self.keys_pressed]

        _cos = cos(cam.lon) * cam.speed
        _sin = sin(cam.lon) * cam.speed

        if K_z in self.keys_pressed:
            cam.z += _cos
            cam.x += _sin
        if K_s in self.keys_pressed:
            cam.z -= _cos
            cam.x -= _sin
            
        if K_d in self.keys_pressed:
            cam.z -= _sin
            cam.x += _cos
        if K_q in self.keys_pressed:
            cam.z += _sin
            cam.x -= _cos
            
        if K_LSHIFT in self.keys_pressed:
            cam.y -= cam.speed
        if K_SPACE in self.keys_pressed:
            cam.y += cam.speed

        self.ctx.clear()
        
        self.set_uniform("u_time", time)
        self.set_uniform("u_camera_pos", (cam.x, cam.y, cam.z))
        self.set_uniform("u_camera_rot", (cos(radians(cam.lon)) * cam.lat, cam.lon))
        
        self.quad.render(self.prog)

    def mouse_position_event(self, x, y, dx, dy):
        cam.lon += dx * cam.lon_speed
        cam.lat += dy * cam.lat_speed

    def key_event(self, key, action, modifiers):
        # Key presses
        if action == self.wnd.keys.ACTION_PRESS:
            self.keys_pressed.add(key)
            # print(key)

        # Key releases
        elif action == self.wnd.keys.ACTION_RELEASE:
            self.keys_pressed.discard(key)


if __name__ == "__main__":
    cam = Camera()
    mglw.run_window_config(App)
